import type {
  AgentSessionEvent,
  ChannelDeletedEvent,
  ChannelEvent,
  CleanCloseResponse,
  CommandEvent,
  ConnectedEvent,
  IdentityDeletedEvent,
  IdentityEvent,
  InboxItemEvent,
  MessageEvent,
  PresenceEvent,
  ReactionEvent,
  ReadPositionEvent,
  ReadPositionMovedBackEvent,
  ReadReceiptEvent,
  SubscriptionEvent,
  ThreadEvent,
} from "../../index.ts";
import { ChannelNameSchema, ChannelSchema } from "../../../channels/server.ts";
import { IdentityNameSchema, IdentitySchema } from "../../../identities/server.ts";
import {
  InboxItemSchema,
  MovedBackReadPositionSchema,
  ReadPositionSchema,
  SubscriptionResponseSchema,
} from "../../../inbox/server.ts";
import {
  MessageIdSchema,
  MessageSchema,
  ReactionCountSchema,
  ReadReceiptSchema,
  TopLevelMessageSchema,
} from "../../../messages/server.ts";
import { isLiveConnectionId, presenceName } from "../../../presence/index.ts";
import { CommandSchema } from "../../../commands/server.ts";
import { PresenceSchema } from "../../../presence/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

const LiveConnectionIdSchema = Schema.Int.pipe(Schema.refine(isLiveConnectionId, { identifier: "LiveConnectionId" }));

export const InboxItemEventSchema = matchesWire<InboxItemEvent>()(
  Schema.Struct({ item: InboxItemSchema, type: Schema.Literal("inbox-item") }),
);

export const ReadPositionEventSchema = matchesWire<ReadPositionEvent>()(
  Schema.Struct({ readPosition: ReadPositionSchema, type: Schema.Literal("read-position") }),
);

export const ReadPositionMovedBackEventSchema = matchesWire<ReadPositionMovedBackEvent>()(
  Schema.Struct({ readPosition: MovedBackReadPositionSchema, type: Schema.Literal("read-position-moved-back") }),
);

export const MessageEventSchema = matchesWire<MessageEvent>()(
  Schema.Struct({ message: MessageSchema, type: Schema.Literal("message") }),
);

export const ThreadEventSchema = matchesWire<ThreadEvent>()(
  Schema.Struct({ parent: TopLevelMessageSchema, type: Schema.Literal("thread") }),
);

export const IdentityEventSchema = matchesWire<IdentityEvent>()(
  Schema.Struct({ identity: IdentitySchema, type: Schema.Literal("identity") }),
);

export const ReadReceiptEventSchema = matchesWire<ReadReceiptEvent>()(
  Schema.Struct({ receipt: ReadReceiptSchema, type: Schema.Literal("read-receipt") }),
);

export const ReactionEventSchema = matchesWire<ReactionEvent>()(
  Schema.Struct({
    channel: ChannelNameSchema,
    messageId: MessageIdSchema,
    reactions: Schema.Array(ReactionCountSchema),
    type: Schema.Literal("reaction"),
  }),
);

export const ChannelEventSchema = matchesWire<ChannelEvent>()(
  Schema.Struct({ channel: ChannelSchema, type: Schema.Literal("channel") }),
);

export const ChannelDeletedEventSchema = matchesWire<ChannelDeletedEvent>()(
  Schema.Struct({ channel: ChannelSchema, type: Schema.Literal("channel-deleted") }),
);

export const IdentityDeletedEventSchema = matchesWire<IdentityDeletedEvent>()(
  Schema.Struct({ identity: IdentitySchema, type: Schema.Literal("identity-deleted") }),
);

export const CommandEventSchema = matchesWire<CommandEvent>()(
  Schema.Struct({ command: CommandSchema, type: Schema.Literal("command") }),
);

export const AgentSessionEventSchema = matchesWire<AgentSessionEvent>()(
  Schema.Struct({ agent: IdentityNameSchema, type: Schema.Literal("agent-session") }),
);

export const SubscriptionEventSchema = matchesWire<SubscriptionEvent>()(
  Schema.Struct({ subscription: SubscriptionResponseSchema, type: Schema.Literal("subscription") }),
);

export const ConnectedEventSchema = matchesWire<ConnectedEvent>()(
  Schema.Struct({
    connectionId: Schema.optionalKey(LiveConnectionIdSchema),
    latestMessageId: Schema.NullOr(MessageIdSchema),
    type: Schema.Literal("connected"),
  }),
);

export const CleanCloseResponseSchema = matchesWire<CleanCloseResponse>()(
  Schema.Struct({ closed: Schema.Literal(true) }),
);

export const PresenceEventSchema = matchesWire<PresenceEvent>()(
  Schema.Struct({ presence: PresenceSchema, type: Schema.Literal(presenceName) }),
);

export { PresenceResponseSchema } from "../../../presence/server.ts";
