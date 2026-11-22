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
export { messageIdSchema } from "./storage.ts";
export type { DeleteIdentityResult, MessageId, StorageAdapter, TokenLookup } from "./storage.ts";
