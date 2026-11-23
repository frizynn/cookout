import type {
  AgentSessionEvent,
  ChannelDeletedEvent,
  ChannelEvent,
  CommandEvent,
  ConnectedEvent,
  IdentityEvent,
  InboxItemEvent,
  MessageEvent,
  ReadPositionEvent,
  SubscriptionEvent,
} from "../../index.ts";
import { IdentityNameSchema, IdentitySchema } from "../../../identities/server.ts";
import { InboxItemSchema, ReadPositionSchema, SubscriptionResponseSchema } from "../../../inbox/server.ts";
import { MessageIdSchema, MessageSchema } from "../../../messages/server.ts";
import { ChannelSchema } from "../../../channels/server.ts";
import { CommandSchema } from "../../../commands/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

export const InboxItemEventSchema = matchesWire<InboxItemEvent>()(
  Schema.Struct({ item: InboxItemSchema, type: Schema.Literal("inbox-item") }),
);

export const ReadPositionEventSchema = matchesWire<ReadPositionEvent>()(
  Schema.Struct({ readPosition: ReadPositionSchema, type: Schema.Literal("read-position") }),
);

export const MessageEventSchema = matchesWire<MessageEvent>()(
  Schema.Struct({ message: MessageSchema, type: Schema.Literal("message") }),
);

export const IdentityEventSchema = matchesWire<IdentityEvent>()(
  Schema.Struct({ identity: IdentitySchema, type: Schema.Literal("identity") }),
);

export const ChannelEventSchema = matchesWire<ChannelEvent>()(
  Schema.Struct({ channel: ChannelSchema, type: Schema.Literal("channel") }),
);

export const ChannelDeletedEventSchema = matchesWire<ChannelDeletedEvent>()(
  Schema.Struct({ channel: ChannelSchema, type: Schema.Literal("channel-deleted") }),
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
  Schema.Struct({ latestMessageId: Schema.NullOr(MessageIdSchema), type: Schema.Literal("connected") }),
);
