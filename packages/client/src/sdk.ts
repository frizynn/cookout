import type { z } from "zod";
import type {
  CreateIdentityRequest,
  HealthResponse,
  IdentityResponse,
  IdentityWithTokenResponse,
  ListIdentitiesResponse,
} from "@ai-hero/cookout-protocol";
import {
  errorResponseSchema,
  healthPath,
  healthResponseSchema,
  identitiesPath,
  identityPath,
  identityResponseSchema,
  identityTokenPath,
  identityWithTokenResponseSchema,
  listIdentitiesResponseSchema,
  whoamiPath,
} from "@ai-hero/cookout-protocol";

export type CookoutClientOptions = {
  /** The server's base URL, e.g. `https://cookout.example.com`. Default: `COOKOUT_URL`. */
  url?: string;
  /** The bearer token. Default: `COOKOUT_TOKEN`. Not needed for the health check. */
  token?: string;
  /** Where `COOKOUT_URL` and `COOKOUT_TOKEN` are read from. Default `process.env`. */
  env?: Record<string, string | undefined>;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
};

export type CookoutClient = {
  /** `GET /v1/health`. Resolves when the server and its storage are usable. */
  health(): Promise<HealthResponse>;
  /** `GET /v1/whoami`: the identity behind this client's token. */
  whoami(): Promise<IdentityResponse>;
  /** `GET /v1/identities`: every identity and its owner, sorted by name. */
  listIdentities(): Promise<ListIdentitiesResponse>;
  /** Admin only. The token in the answer is shown this once. */
  createIdentity(request: CreateIdentityRequest): Promise<IdentityWithTokenResponse>;
  /** Admin only. Issues a new token; the old one stops working at once. */
  rotateToken(name: string): Promise<IdentityWithTokenResponse>;
  /** Admin only. Removes the identity; its token stops working. */
  deleteIdentity(name: string): Promise<IdentityResponse>;
};

/**
 * An error from the server (its `{ error: { code, message, details? } }`
 * body), or `bad_response` when the server's answer isn't what the protocol
 * says. `url_missing` (status 0) means no URL was given and `COOKOUT_URL` is unset.
 */
export class CookoutError extends Error {
  override readonly name = "CookoutError";
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(options: { status: number; code: string; message: string; details?: unknown }) {
    super(options.message);
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export function createCookoutClient(options: CookoutClientOptions = {}): CookoutClient {
  const env = options.env ?? process.env;
  const url = options.url ?? env["COOKOUT_URL"];
  if (url === undefined || url === "") {
    throw new CookoutError({ status: 0, code: "url_missing", message: "Set COOKOUT_URL to the cookout server's address." });
  }
  const token = options.token ?? (env["COOKOUT_TOKEN"] === "" ? undefined : env["COOKOUT_TOKEN"]);
  const baseUrl = url.replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;

  async function request<Schema extends z.ZodType>(
    method: string,
    path: string,
    responseSchema: Schema,
    body?: unknown,
  ): Promise<z.infer<Schema>> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (token !== undefined) headers["authorization"] = `Bearer ${token}`;
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await doFetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    let json: unknown;
    try {
      json = text === "" ? undefined : JSON.parse(text);
    } catch {
      json = undefined;
    }

    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(json);
      if (parsed.success) {
        throw new CookoutError({ status: response.status, ...parsed.data.error });
      }
      throw new CookoutError({
        status: response.status,
        code: "bad_response",
        message: `${method} ${path} failed with ${response.status} and no error body.`,
        details: text,
      });
    }

    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) {
      throw new CookoutError({
        status: response.status,
        code: "bad_response",
        message: `${method} ${path} returned a body that doesn't match the protocol.`,
        details: parsed.error.issues,
      });
    }
    return parsed.data;
  }

  return {
    health: () => request("GET", healthPath, healthResponseSchema),
    whoami: () => request("GET", whoamiPath, identityResponseSchema),
    listIdentities: () => request("GET", identitiesPath, listIdentitiesResponseSchema),
    createIdentity: (body) =>
      request("POST", identitiesPath, identityWithTokenResponseSchema, body),
    rotateToken: (name) => request("POST", identityTokenPath(name), identityWithTokenResponseSchema),
    deleteIdentity: (name) => request("DELETE", identityPath(name), identityResponseSchema),
  };
}
