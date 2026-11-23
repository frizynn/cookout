import type {
  AckResponse,
  FollowResponse,
  InboxItem,
  InboxResponse,
  ReadPosition,
  SubscriptionResponse,
} from "../../index.ts";
import { ChannelNameSchema, ChannelSchema } from "../../../channels/server.ts";
import { MessageIdSchema, MessageSchema, TopLevelMessageSchema } from "../../../messages/server.ts";
import { Schema } from "effect";
import { inboxReasons } from "../../index.ts";
import { matchesWire } from "../../../http/index.ts";

const InboxReasonSchema = Schema.Literals(inboxReasons);

const ReadPositionSchema = matchesWire<ReadPosition>()(
  Schema.Struct({ channel: ChannelNameSchema, messageId: MessageIdSchema, thread: Schema.NullOr(MessageIdSchema) }),
);

export const InboxItemSchema = matchesWire<InboxItem>()(
  Schema.Struct({
    channel: ChannelSchema,
    message: MessageSchema,
    parent: TopLevelMessageSchema,
    reasons: Schema.Array(InboxReasonSchema),
  }),
);

export const AckRequestSchema = Schema.Struct({ messageId: MessageIdSchema });

export const InboxResponseSchema = matchesWire<InboxResponse>()(
  Schema.Struct({ items: Schema.Array(InboxItemSchema) }),
);

export const AckResponseSchema = matchesWire<AckResponse>()(Schema.Struct({ readPosition: ReadPositionSchema }));

export const FollowResponseSchema = matchesWire<FollowResponse>()(
  Schema.Struct({ following: Schema.Boolean, thread: MessageIdSchema }),
);

export const SubscriptionResponseSchema = matchesWire<SubscriptionResponse>()(
  Schema.Struct({ channel: ChannelNameSchema, subscribed: Schema.Boolean }),
);
