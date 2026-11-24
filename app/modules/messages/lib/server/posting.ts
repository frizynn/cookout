import { Array as Arr, DateTime, Effect, Option, Predicate, String as Str, pipe } from "effect";
import type { Author, JsonValue, Message, MessageId, MessageResponse, Reply } from "../../index.ts";
import type { Harness, Identity } from "../../../identities/index.ts";
import type { NewMessage, Storage, StorageUnavailable } from "../../../storage/server.ts";
import type { PubSub, Scope } from "effect";
import { closeWithoutReplyTo, messageNotFound, replyInOtherChannel, seenWithoutReplyTo } from "./refusals.ts";
import { movedSince, threadMovedWarning } from "./thread-moved.ts";
import type { ChannelName } from "../../../channels/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { channelNotFound } from "../../../channels/server.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { mentionPattern } from "../../index.ts";

interface PostMessage {
  readonly channel: ChannelName;
  readonly text: string;
  readonly data?: JsonValue;
  readonly replyTo?: MessageId;
  readonly close?: true;
  readonly harness?: Harness;
  readonly seen?: MessageId;
}

type Refused = "channel_not_found" | "reply_to_not_found" | "reply_in_other_channel";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

interface Hub {
  readonly appendThenPublish: <Result extends Appended>(
    append: (message: NewMessage) => Fails<Result>,
    message: NewMessage,
  ) => Fails<Result>;
  readonly subscribe: Effect.Effect<PubSub.Subscription<Message>, never, Scope.Scope>;
}

function authorOf(identity: Identity): Author {
  if (identity.kind === "human" || Predicate.isUndefined(identity.owner)) {
    return { name: identity.name };
  }
  return { name: identity.name, owner: identity.owner };
}

function withReplyTo(message: NewMessage, replyTo: MessageId | undefined): NewMessage {
  if (Predicate.isUndefined(replyTo)) {
    return message;
  }
  return { ...message, replyTo };
}

function mentionedNames(text: string): readonly string[] {
  return pipe(text, Str.match(mentionPattern), Option.map(Arr.dedupe), Option.getOrElse(Arr.empty));
}

function unknownMentionsIn({ mentions, text }: Message): readonly string[] {
  return Arr.filter(mentionedNames(text), (name) => !Arr.some(mentions, (mentioned) => mentioned === name));
}

function withClose(message: NewMessage, close: true | undefined): NewMessage {
  if (Predicate.isUndefined(close)) {
    return message;
  }
  return { ...message, close };
}

function withHarness(message: NewMessage, harness: Harness | undefined): NewMessage {
  if (Predicate.isUndefined(harness)) {
    return message;
  }
  return { ...message, harness };
}

function newMessage(author: Identity, posting: PostMessage, createdAt: NewMessage["createdAt"]): NewMessage {
  const { close, harness, channel, data, replyTo, text } = posting;
  const mentions = Arr.filter(mentionedNames(text), isIdentityName);
  const fields = withClose(
    withHarness({ author: authorOf(author), channel, createdAt, mentions, text }, harness),
    close,
  );
  if (Predicate.isUndefined(data)) {
    return withReplyTo(fields, replyTo);
  }
  return withReplyTo({ ...fields, data }, replyTo);
}

function refusalOf(status: Refused, message: PostMessage): Refusal {
  if (status === "channel_not_found") {
    return channelNotFound(message.channel);
  }
  if (status === "reply_to_not_found") {
    return messageNotFound(String(message.replyTo));
  }
  return replyInOtherChannel(message);
}

type Append = Storage["Service"]["appendMessage"];

type Appended = Effect.Success<ReturnType<Append>>;

interface Posting {
  readonly hub: Hub;
  readonly append: Append;
  readonly storage: Storage["Service"];
}

function unfitRefusal({ close, replyTo, seen }: PostMessage): Option.Option<Refusal> {
  if (Predicate.isNotUndefined(replyTo)) {
    return Option.none();
  }
  if (Predicate.isNotUndefined(close)) {
    return Option.some(closeWithoutReplyTo);
  }
  return Option.map(Option.fromUndefinedOr(seen), () => seenWithoutReplyTo);
}

type Moved = Appended & { readonly moved: readonly Reply[] };

function appendNoting({ append, storage }: Posting, author: Identity, message: PostMessage) {
  return (stored: NewMessage): Fails<Moved> =>
    Effect.zipWith(
      movedSince({ author, replyTo: message.replyTo, seen: message.seen, storage }),
      append(stored),
      (moved, appended) => ({ ...appended, moved }),
    );
}

function answerTo(posting: Posting, message: PostMessage): (result: Moved) => Fails<MessageResponse> {
  return (result) => {
    if (result.status !== "appended") {
      return Effect.fail(refusalOf(result.status, message));
    }
    return Effect.map(threadMovedWarning({ moved: result.moved, storage: posting.storage }), (warned) => ({
      message: result.message,
      unknownMentions: unknownMentionsIn(result.message),
      ...warned,
    }));
  };
}

function postWith(posting: Posting): (author: Identity, message: PostMessage) => Fails<MessageResponse> {
  return (author, message) =>
    Effect.gen(function* postMessage() {
      const unfit = unfitRefusal(message);
      if (Option.isSome(unfit)) {
        return yield* Effect.fail(unfit.value);
      }
      const now = yield* DateTime.now;
      const stored = newMessage(author, message, isoTimeOf(now));
      const result = yield* posting.hub.appendThenPublish(appendNoting(posting, author, message), stored);
      return yield* answerTo(posting, message)(result);
    });
}

export { type Append, type Appended, type Hub, type PostMessage, postWith };
