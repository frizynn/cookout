// Entry point of @ai-hero/cookout-protocol. Other packages import this file only, by package name.
export const packageName = "@ai-hero/cookout-protocol";

export { errorResponseSchema } from "./errors.ts";
export type { ErrorResponse } from "./errors.ts";
export { healthPath, healthResponseSchema } from "./health.ts";
export type { HealthResponse } from "./health.ts";
export { messageIdSchema } from "./storage.ts";
export type { MessageId, StorageAdapter } from "./storage.ts";
