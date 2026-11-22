// Entry point of @ai-hero/cookout-client. Other packages import this file only, by package name.
export const packageName = "@ai-hero/cookout-client";

export { CookoutError, createCookoutClient } from "./sdk.ts";
export type { CookoutClient, CookoutClientOptions } from "./sdk.ts";
