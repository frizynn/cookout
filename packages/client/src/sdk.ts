import type { z } from "zod";
import type { HealthResponse } from "@ai-hero/cookout-protocol";
import { errorResponseSchema, healthPath, healthResponseSchema } from "@ai-hero/cookout-protocol";

export type CookoutClientOptions = {
  /** The server's base URL, e.g. `https://cookout.example.com`. */
  url: string;
  /** The bearer token. Not needed for the health check. */
  token?: string;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
};

export type CookoutClient = {
  /** `GET /v1/health`. Resolves when the server and its storage are usable. */
  health(): Promise<HealthResponse>;
};

/**
 * An error from the server (its `{ error: { code, message, details? } }`
 * body), or `bad_response` when the server's answer isn't what the protocol
 * says.
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

export function createCookoutClient(options: CookoutClientOptions): CookoutClient {
  const baseUrl = options.url.replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;

  async function request<Schema extends z.ZodType>(
    method: string,
    path: string,
    responseSchema: Schema,
  ): Promise<z.infer<Schema>> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.token !== undefined) headers["authorization"] = `Bearer ${options.token}`;
    const response = await doFetch(`${baseUrl}${path}`, { method, headers });
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
  };
}
