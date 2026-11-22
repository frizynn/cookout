/**
 * `@ai-hero/cookout/sdk`: a client for a cookout server, in plain TypeScript
 * for Node and the browser. Every answer is checked against the protocol; one
 * that doesn't match fails with `CookoutError` code `bad_response`.
 */
import type { HealthResponse } from "../http/index.ts";
import { healthPath } from "../http/index.ts";
import { getJson } from "./lib/request.ts";
import { isHealthResponse } from "./lib/generated/validators.js";

export type { HealthResponse } from "../http/index.ts";
export { CookoutError, type CookoutErrorCode } from "./lib/errors.ts";

export type CookoutClientOptions = {
  /** The server's base URL, such as `https://cookout.example.com`. */
  readonly url: string;
  /** The bearer token. Not needed for the health check. */
  readonly token?: string;
};

export type CookoutClient = {
  /** `GET /v1/health`. Resolves when the server and its storage are usable. */
  readonly health: () => Promise<HealthResponse>;
};

/** A client for the server at `url`. */
export function createCookoutClient(options: CookoutClientOptions): CookoutClient {
  return {
    health: () => getJson(options, healthPath, isHealthResponse),
  };
}
