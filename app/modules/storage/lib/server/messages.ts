import { Array as Arr, Option, Predicate, pipe } from "effect";
import type {
  ListMessagesResponse,
  Message,
  MessageId,
  Reply,
  ThreadResponse,
  TopLevelMessage,
} from "../../../messages/index.ts";
import type { ChannelName } from "../../../channels/index.ts";
import type { Effect } from "effect";
import type { IdentityName } from "../../../identities/index.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isMessageId } from "../../../messages/index.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

type MessageContent = Omit<TopLevelMessage, "id" | "kind" | "latestReplyId" | "replyCount">;

type NewMessage = MessageContent & {
  readonly replyTo?: MessageId;
};

type AppendMessageResult =
  | { readonly status: "appended"; readonly message: Message }
  | { readonly status: "channel_not_found" }
  | { readonly status: "reply_to_not_found" }
  | { readonly status: "reply_in_other_channel" };

type Placed = { readonly status: "top-level" } | { readonly status: "reply"; readonly parent: MessageId };

type Placement = Placed | { readonly status: "reply_to_not_found" } | { readonly status: "reply_in_other_channel" };

interface ChannelPageRequest {
  readonly before?: MessageId;
  readonly limit: number;
}

interface FoundReplyTo {
  readonly channel: ChannelName;
  readonly found: Message | undefined;
}

interface Placing {
  readonly id: MessageId;
  readonly message: NewMessage;
  readonly placement: Placed;
}

interface Mentioning {
  readonly known: ReadonlySet<IdentityName>;
  readonly message: NewMessage;
}

interface Counting {
  readonly parent: TopLevelMessage;
  readonly replies: readonly Reply[];
}

interface MessagesSection {
  readonly appendMessage: (message: NewMessage) => Fails<AppendMessageResult>;
  readonly listChannelMessages: (
    channel: ChannelName,
    page: ChannelPageRequest,
  ) => Fails<ListMessagesResponse | undefined>;
  readonly getThread: (id: MessageId) => Fails<ThreadResponse | undefined>;
}

const NO_REPLIES = 0;

function asMessageId(value: number): MessageId {
  return Option.getOrThrow(Option.liftPredicate(value, isMessageId));
}

function threadIdOf(message: Message): MessageId {
  if (message.kind === "reply") {
    return message.replyTo;
  }
  return message.id;
}

function placeIn({ channel, found }: FoundReplyTo): Placement {
  if (Predicate.isUndefined(found)) {
    return { status: "reply_to_not_found" };
  }
  if (found.channel !== channel) {
    return { status: "reply_in_other_channel" };
  }
  return { parent: threadIdOf(found), status: "reply" };
}

function isPlaced(placement: Placement): placement is Placed {
  return placement.status === "top-level" || placement.status === "reply";
}

function placed({ id, message, placement }: Placing): Message {
  if (placement.status === "reply") {
    return { ...message, id, kind: "reply", replyTo: placement.parent };
  }
  return { ...message, id, kind: "top-level", latestReplyId: null, replyCount: NO_REPLIES };
}

function withKnownMentions({ known, message }: Mentioning): NewMessage {
  return { ...message, mentions: Arr.filter(message.mentions, (name) => known.has(name)) };
}

function counted({ parent, replies }: Counting): TopLevelMessage {
  const latestReplyId = pipe(
    Arr.last(replies),
    Option.map((reply) => reply.id),
    Option.getOrNull,
  );
  return { ...parent, latestReplyId, replyCount: replies.length };
}

export {
  type AppendMessageResult,
  type ChannelPageRequest,
  type MessagesSection,
  type NewMessage,
  type Placement,
  asMessageId,
  counted,
  isPlaced,
  placeIn,
  placed,
  threadIdOf,
  withKnownMentions,
};
