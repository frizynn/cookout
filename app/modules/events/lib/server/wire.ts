import type {
  ChannelEvent,
  ConnectedEvent,
  IdentityEvent,
  InboxItemEvent,
  MessageEvent,
  PresenceEvent,
  ReadPositionEvent,
  ReadPositionMovedBackEvent,
  SubscriptionEvent,
} from "../../index.ts";
import {
  InboxItemSchema,
  MovedBackReadPositionSchema,
  ReadPositionSchema,
  SubscriptionResponseSchema,
} from "../../../inbox/server.ts";
import { MessageIdSchema, MessageSchema } from "../../../messages/server.ts";
import { ChannelSchema } from "../../../channels/server.ts";
import { IdentitySchema } from "../../../identities/server.ts";
import { PresenceSchema } from "../../../presence/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";
import { presenceName } from "../../../presence/index.ts";

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

export const IdentityEventSchema = matchesWire<IdentityEvent>()(
  Schema.Struct({ identity: IdentitySchema, type: Schema.Literal("identity") }),
);

export const ChannelEventSchema = matchesWire<ChannelEvent>()(
  Schema.Struct({ channel: ChannelSchema, type: Schema.Literal("channel") }),
);

export const SubscriptionEventSchema = matchesWire<SubscriptionEvent>()(
  Schema.Struct({ subscription: SubscriptionResponseSchema, type: Schema.Literal("subscription") }),
);

export const ConnectedEventSchema = matchesWire<ConnectedEvent>()(
  Schema.Struct({ latestMessageId: Schema.NullOr(MessageIdSchema), type: Schema.Literal("connected") }),
);

export const PresenceEventSchema = matchesWire<PresenceEvent>()(
  Schema.Struct({ presence: PresenceSchema, type: Schema.Literal(presenceName) }),
);

export { PresenceResponseSchema } from "../../../presence/server.ts";
