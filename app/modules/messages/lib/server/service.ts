import { Array as Arr, Context, DateTime, Effect, Layer, Option, Predicate, String as Str, pipe } from "effect";
import type {
  Author,
  JsonValue,
  ListMessagesResponse,
  Message,
  MessageId,
  MessageResponse,
  ThreadResponse,
} from "../../index.ts";
import type { NewMessage, StorageUnavailable } from "../../../storage/server.ts";
import { mentionPattern, pageSize } from "../../index.ts";
import { messageNotFound, replyInOtherChannel } from "./refusals.ts";
import type { ChannelName } from "../../../channels/index.ts";
import type { Identity } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { Storage } from "../../../storage/server.ts";
import { channelNotFound } from "../../../channels/server.ts";
import { isChannelName } from "../../../channels/index.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { isoTimeOf } from "../../../time/server.ts";

interface PostMessage {
  readonly channel: ChannelName;
  readonly text: string;
  readonly data?: JsonValue;
  readonly replyTo?: MessageId;
}

interface PageQuery {
  readonly before?: MessageId;
  readonly limit?: number;
}

interface PageRequest {
  readonly before?: MessageId;
  readonly limit: number;
}

type Refused = "channel_not_found" | "reply_to_not_found" | "reply_in_other_channel";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

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

function newMessage(author: Identity, { channel, data, replyTo, text }: PostMessage, createdAt: IsoTime): NewMessage {
  const mentions = Arr.filter(mentionedNames(text), isIdentityName);
  const fields: NewMessage = { author: authorOf(author), channel, createdAt, mentions, text };
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

function pageRequest({ before, limit = pageSize.default }: PageQuery): PageRequest {
  if (Predicate.isUndefined(before)) {
    return { limit };
  }
  return { before, limit };
}

function messagesOn(storage: Storage["Service"]): MessagesService {
  return {
    page: (channel, query) =>
      Effect.gen(function* pageChannel() {
        if (!isChannelName(channel)) {
          return yield* Effect.fail(channelNotFound(channel));
        }
        const page = yield* storage.listChannelMessages(channel, pageRequest(query));
        if (Predicate.isUndefined(page)) {
          return yield* Effect.fail(channelNotFound(channel));
        }
        return page;
      }),
    post: (author, message) =>
      Effect.gen(function* postMessage() {
        const now = yield* DateTime.now;
        const result = yield* storage.appendMessage(newMessage(author, message, isoTimeOf(now)));
        if (result.status === "appended") {
          return { message: result.message, unknownMentions: unknownMentionsIn(result.message) };
        }
        return yield* Effect.fail(refusalOf(result.status, message));
      }),
    thread: (id) =>
      Effect.gen(function* getThread() {
        const thread = yield* storage.getThread(id);
        if (Predicate.isUndefined(thread)) {
          return yield* Effect.fail(messageNotFound(String(id)));
        }
        return thread;
      }),
  };
}

export interface MessagesService {
  readonly post: (author: Identity, message: PostMessage) => Fails<MessageResponse>;
  readonly thread: (id: MessageId) => Fails<ThreadResponse>;
  readonly page: (channel: string, query: PageQuery) => Fails<ListMessagesResponse>;
}

export class Messages extends Context.Service<Messages, MessagesService>()(
  "@ai-hero/cookout/messages/lib/server/service/Messages",
) {}

export const messagesLayer: Layer.Layer<Messages, never, Storage> = Layer.effect(
  Messages,
  Effect.gen(function* messagesOnStorage() {
    const storage = yield* Storage;
    return messagesOn(storage);
  }),
);
