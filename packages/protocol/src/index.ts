// Entry point of @ai-hero/cookout-protocol. Other packages import this file only, by package name.
export const packageName = "@ai-hero/cookout-protocol";

export { errorResponseSchema } from "./errors.ts";
export type { ErrorResponse } from "./errors.ts";
export { healthPath, healthResponseSchema } from "./health.ts";
export type { HealthResponse } from "./health.ts";
export {
  createIdentityRequestSchema,
  identitiesPath,
  identityNameSchema,
  identityPath,
  identityResponseSchema,
  identitySchema,
  identityTokenPath,
  identityWithTokenResponseSchema,
  listIdentitiesResponseSchema,
  ownerSchema,
  tokenSchema,
  whoamiPath,
} from "./identities.ts";
export type {
  CreateIdentityRequest,
  Identity,
  IdentityName,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesResponse,
} from "./identities.ts";
export {
  channelDescriptionSchema,
  channelNameSchema,
  channelPath,
  channelResponseSchema,
  channelSchema,
  channelsPath,
  createChannelRequestSchema,
  listChannelsResponseSchema,
} from "./channels.ts";
export type {
  Channel,
  ChannelName,
  ChannelResponse,
  CreateChannelRequest,
  ListChannelsResponse,
} from "./channels.ts";
export {
  authorSchema,
  channelMessagesPath,
  defaultPageSize,
  listMessagesQuerySchema,
  listMessagesResponseSchema,
  maxPageSize,
  messageIdSchema,
  messageResponseSchema,
  messageSchema,
  messagesPath,
  messageTextSchema,
  postMessageRequestSchema,
  replySchema,
  threadPath,
  threadResponseSchema,
  topLevelMessageSchema,
} from "./messages.ts";
export type {
  Author,
  ListMessagesQuery,
  ListMessagesResponse,
  Message,
  MessageId,
  MessageResponse,
  PostMessageRequest,
  Reply,
  ThreadResponse,
  TopLevelMessage,
} from "./messages.ts";
export type {
  AppendMessageResult,
  ChannelPage,
  DeleteIdentityResult,
  NewMessage,
  StorageAdapter,
  Thread,
  TokenLookup,
} from "./storage.ts";
