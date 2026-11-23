import type {
  Author,
  ListMessagesResponse,
  MessageResponse,
  Reply,
  ThreadResponse,
  TopLevelMessage,
} from "../../index.ts";
import {
  agentToolPattern,
  identityNamePattern,
  isAgentTool,
  isIdentityName,
  isOwner,
  plainNamePattern,
} from "../../../identities/index.ts";
import { channelNamePattern, isChannelName } from "../../../channels/index.ts";
import { isMessageId, messageTextLength, pageSize, shownRepliers } from "../../index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { Schema } from "effect";
import { matchesWire } from "../../../http/index.ts";

const NO_REPLIES = 0;
const LOWEST_ID = 1;

const channelNameRule = Schema.isPattern(channelNamePattern).abort();
const ChannelNameSchema = Schema.String.check(channelNameRule).pipe(
  Schema.refine(isChannelName, { identifier: "ChannelName" }),
);

const identityNameRule = Schema.isPattern(identityNamePattern).abort();
const IdentityNameSchema = Schema.String.check(identityNameRule).pipe(
  Schema.refine(isIdentityName, { identifier: "IdentityName" }),
);

const ownerRule = Schema.isPattern(plainNamePattern).abort();
const OwnerSchema = Schema.String.check(ownerRule).pipe(Schema.refine(isOwner, { identifier: "Owner" }));

const positive = Schema.isGreaterThanOrEqualTo(LOWEST_ID).abort();
const MessageIdSchema = Schema.Int.check(positive).pipe(Schema.refine(isMessageId, { identifier: "MessageId" }));

const textRule = Schema.isBetweenLength(messageTextLength.minimum, messageTextLength.maximum);
const TextSchema = Schema.String.check(textRule);

const AuthorSchema = matchesWire<Author>()(
  Schema.Struct({ name: IdentityNameSchema, owner: Schema.optionalKey(OwnerSchema) }),
);

const agentToolRule = Schema.isPattern(agentToolPattern).abort();
const AgentToolSchema = Schema.String.check(agentToolRule).pipe(
  Schema.refine(isAgentTool, { identifier: "AgentTool" }),
);

const messageFields = {
  agentTool: Schema.optionalKey(AgentToolSchema),
  author: AuthorSchema,
  channel: ChannelNameSchema,
  createdAt: IsoTimeSchema,
  data: Schema.optionalKey(Schema.Json),
  id: MessageIdSchema,
  mentions: Schema.Array(IdentityNameSchema),
  text: TextSchema,
};

const ReplyCountSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(NO_REPLIES));

const RepliersSchema = Schema.Array(AuthorSchema).check(Schema.isMaxLength(shownRepliers));

const TopLevelMessageSchema = matchesWire<TopLevelMessage>()(
  Schema.Struct({
    ...messageFields,
    kind: Schema.Literal("top-level"),
    latestReplyAt: Schema.NullOr(IsoTimeSchema),
    latestReplyId: Schema.NullOr(MessageIdSchema),
    repliers: RepliersSchema,
    replyCount: ReplyCountSchema,
  }),
);

const ReplySchema = matchesWire<Reply>()(
  Schema.Struct({ ...messageFields, kind: Schema.Literal("reply"), replyTo: MessageIdSchema }),
);

const MessageSchema = Schema.Union([TopLevelMessageSchema, ReplySchema]);

const pageLimit = Schema.isBetween({ maximum: pageSize.maximum, minimum: pageSize.minimum });
const LimitSchema = Schema.Int.check(pageLimit);
const decodesToLimit = Schema.decodeTo(LimitSchema);
const decodesToMessageId = Schema.decodeTo(MessageIdSchema);

const MessageIdFromString = Schema.FiniteFromString.pipe(decodesToMessageId);

export const PostMessageRequestSchema = Schema.Struct({
  channel: ChannelNameSchema,
  data: Schema.optionalKey(Schema.Json),
  replyTo: Schema.optionalKey(MessageIdSchema),
  text: TextSchema,
});

export const ListMessagesQuerySchema = Schema.Struct({
  before: Schema.optionalKey(MessageIdFromString),
  limit: Schema.optionalKey(Schema.FiniteFromString.pipe(decodesToLimit)),
});

export const MessageResponseSchema = matchesWire<MessageResponse>()(
  Schema.Struct({ message: MessageSchema, unknownMentions: Schema.Array(Schema.String) }),
);

export const ListMessagesResponseSchema = matchesWire<ListMessagesResponse>()(
  Schema.Struct({ hasMore: Schema.Boolean, messages: Schema.Array(TopLevelMessageSchema) }),
);

export const ThreadResponseSchema = matchesWire<ThreadResponse>()(
  Schema.Struct({ parent: TopLevelMessageSchema, replies: Schema.Array(ReplySchema) }),
);

export { MessageIdSchema, MessageSchema, TopLevelMessageSchema };
