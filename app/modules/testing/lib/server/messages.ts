import type { Author, JsonValue, Message, MessageId } from "../../../messages/index.ts";
import { Effect, Option, Predicate } from "effect";
import type { NewMessage, Storage } from "../../../storage/server.ts";
import { channelName } from "./channels.ts";
import { identityName } from "./identities.ts";
import { isMessageId } from "../../../messages/index.ts";
import { isOwner } from "../../../identities/index.ts";

interface AuthorOptions {
  readonly name: string;
  readonly owner?: string;
}

interface NewMessageOptions {
  readonly author?: AuthorOptions;
  readonly data?: JsonValue;
  readonly replyTo?: MessageId;
}

type Append = (message: NewMessage) => Effect.Effect<Message>;

const CREATED_AT = "2026-01-01T00:00:00.000Z";
const AGENT: AuthorOptions = { name: "agent", owner: "matt" };

function messageId(value: number): MessageId {
  return Option.getOrThrow(Option.liftPredicate(value, isMessageId));
}

function authorFixture({ name, owner }: AuthorOptions): Author {
  if (Predicate.isUndefined(owner)) {
    return { name: identityName(name) };
  }
  return { name: identityName(name), owner: Option.getOrThrow(Option.liftPredicate(owner, isOwner)) };
}

function withReplyTo(message: NewMessage, replyTo: MessageId | undefined): NewMessage {
  if (Predicate.isUndefined(replyTo)) {
    return message;
  }
  return { ...message, replyTo };
}

function withOptions(message: NewMessage, { data, replyTo }: NewMessageOptions): NewMessage {
  if (Predicate.isUndefined(data)) {
    return withReplyTo(message, replyTo);
  }
  return withReplyTo({ ...message, data }, replyTo);
}

function newMessageFixture(channel: string, text: string, ...options: readonly NewMessageOptions[]): NewMessage {
  const [extra = {}] = options;
  const message: NewMessage = {
    author: authorFixture(extra.author ?? AGENT),
    channel: channelName(channel),
    createdAt: CREATED_AT,
    mentions: [],
    text,
  };
  return withOptions(message, extra);
}

function appendTo({ appendMessage }: Pick<Storage["Service"], "appendMessage">): Append {
  return (message) =>
    appendMessage(message).pipe(
      Effect.filterOrFail((result) => result.status === "appended"),
      Effect.map((result) => result.message),
      Effect.orDie,
    );
}

export { type NewMessageOptions, appendTo, messageId, newMessageFixture };
