import type {
  AckAllRequest,
  AckAllResponse,
  AckResponse,
  FollowResponse,
  InboxHistoryItem,
  InboxHistoryNudge,
  InboxHistoryResponse,
  InboxItem,
  InboxResponse,
  MarkUnreadResponse,
  MovedBackReadPosition,
  Nudge,
  NudgeResponse,
  OfflineAlert,
  OfflineAlertResponse,
  ReadPosition,
  ReadPositionsResponse,
  SubscriptionResponse,
} from "../../index.ts";
import { ChannelNameSchema, ChannelSchema } from "../../../channels/server.ts";
import { MessageIdSchema, MessageSchema, ReactionSchema, TopLevelMessageSchema } from "../../../messages/server.ts";
import { inboxReasons, isNudgeId, nudgeKinds } from "../../index.ts";
import { isOfflineAlertId, offlineReasons } from "../../../presence/index.ts";
import { IdentityNameSchema } from "../../../identities/server.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

const InboxReasonSchema = Schema.Literals(inboxReasons);

const OfflineAlertIdSchema = Schema.Int.pipe(Schema.refine(isOfflineAlertId, { identifier: "OfflineAlertId" }));

const inboxItemFields = {
  channel: ChannelSchema,
  message: MessageSchema,
  newReactions: Schema.optionalKey(Schema.Array(ReactionSchema)),
  parent: TopLevelMessageSchema,
  reasons: Schema.Array(InboxReasonSchema),
};

const NudgeIdSchema = Schema.Int.pipe(Schema.refine(isNudgeId, { identifier: "NudgeId" }));

const nudgeFields = {
  channel: ChannelSchema,
  id: NudgeIdSchema,
  kind: Schema.Literals(nudgeKinds),
  parent: TopLevelMessageSchema,
  raisedAt: IsoTimeSchema,
  text: Schema.String,
};

const NudgeSchema = matchesWire<Nudge>()(Schema.Struct(nudgeFields));

const InboxHistoryNudgeSchema = matchesWire<InboxHistoryNudge>()(
  Schema.Struct({ ...nudgeFields, read: Schema.Boolean }),
);

const NudgeResponseSchema = matchesWire<NudgeResponse>()(Schema.Struct({ nudge: InboxHistoryNudgeSchema }));

const InboxHistoryItemSchema = matchesWire<InboxHistoryItem>()(
  Schema.Struct({ ...inboxItemFields, read: Schema.Boolean }),
);

export const OfflineAlertSchema = matchesWire<OfflineAlert>()(
  Schema.Struct({
    agent: IdentityNameSchema,
    backOnlineAt: Schema.optionalKey(IsoTimeSchema),
    id: OfflineAlertIdSchema,
    offlineReason: Schema.Literals(offlineReasons),
    raisedAt: IsoTimeSchema,
    read: Schema.Boolean,
  }),
);

export const OfflineAlertResponseSchema = matchesWire<OfflineAlertResponse>()(
  Schema.Struct({ alert: OfflineAlertSchema }),
);

export const ReadPositionSchema = matchesWire<ReadPosition>()(
  Schema.Struct({ channel: ChannelNameSchema, messageId: MessageIdSchema, thread: Schema.NullOr(MessageIdSchema) }),
);

export const MovedBackReadPositionSchema = matchesWire<MovedBackReadPosition>()(
  Schema.Struct({
    channel: ChannelNameSchema,
    messageId: Schema.NullOr(MessageIdSchema),
    thread: Schema.NullOr(MessageIdSchema),
  }),
);

export const MarkUnreadRequestSchema = Schema.Struct({ messageId: MessageIdSchema });

export const MarkUnreadResponseSchema = matchesWire<MarkUnreadResponse>()(
  Schema.Struct({ readPosition: MovedBackReadPositionSchema }),
);

export const ReadPositionsResponseSchema = matchesWire<ReadPositionsResponse>()(
  Schema.Struct({ readPositions: Schema.Array(ReadPositionSchema) }),
);

export const InboxItemSchema = matchesWire<InboxItem>()(Schema.Struct(inboxItemFields));

export const InboxHistoryResponseSchema = matchesWire<InboxHistoryResponse>()(
  Schema.Struct({
    alerts: Schema.Array(OfflineAlertSchema),
    hasMore: Schema.Boolean,
    items: Schema.Array(InboxHistoryItemSchema),
    nudges: Schema.Array(InboxHistoryNudgeSchema),
  }),
);

export const AckRequestSchema = Schema.Struct({ messageId: MessageIdSchema });

export const AckAllRequestSchema = matchesWire<AckAllRequest>()(
  Schema.Struct({
    alertsUpTo: Schema.optionalKey(OfflineAlertIdSchema),
    nudgesUpTo: Schema.optionalKey(NudgeIdSchema),
    upTo: Schema.optionalKey(MessageIdSchema),
  }),
);

export const AckAllResponseSchema = matchesWire<AckAllResponse>()(
  Schema.Struct({ alerts: Schema.Array(OfflineAlertSchema), readPositions: Schema.Array(ReadPositionSchema) }),
);

export const InboxResponseSchema = matchesWire<InboxResponse>()(
  Schema.Struct({
    alerts: Schema.Array(OfflineAlertSchema),
    items: Schema.Array(InboxItemSchema),
    nudges: Schema.Array(NudgeSchema),
  }),
);

export const AckResponseSchema = matchesWire<AckResponse>()(Schema.Struct({ readPosition: ReadPositionSchema }));

export const FollowResponseSchema = matchesWire<FollowResponse>()(
  Schema.Struct({ following: Schema.Boolean, thread: MessageIdSchema }),
);

export const SubscriptionResponseSchema = matchesWire<SubscriptionResponse>()(
  Schema.Struct({ channel: ChannelNameSchema, subscribed: Schema.Boolean }),
);

export { PageQuerySchema as InboxHistoryQuerySchema } from "../../../messages/server.ts";

export { NudgeResponseSchema, NudgeSchema };
