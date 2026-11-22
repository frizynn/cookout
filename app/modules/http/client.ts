/**
 * The one owner of `fetch` and of URL and query-string building, for the SDK
 * and the web. It speaks HTTP and JSON and knows nothing of what the bodies mean.
 */

type QueryValue = string | number | undefined;

interface Parsed {
  readonly json?: unknown;
}

const NO_PARAMS = 0;
const TRAILING_SLASHES = /\/+$/u;
const PARAM = /:(?<name>[A-Za-z]+)/gu;

function queryString(query: Readonly<Record<string, QueryValue>>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (typeof value === "string" || typeof value === "number") {
      search.set(name, String(value));
    }
  }
  if (search.size === NO_PARAMS) {
    return "";
  }
  return `?${search.toString()}`;
}

function parsed(text: string): Parsed {
  try {
    const json: unknown = JSON.parse(text);
    return { json };
  } catch {
    return {};
  }
}

function fillParams(path: string, params: Readonly<Record<string, string>>): string {
  return path.replaceAll(PARAM, (_match: string, name: string) => encodeURIComponent(params[name] ?? ""));
}

/** The HTTP methods the cookout's routes use. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** One request to a cookout server. */
export interface HttpRequest {
  readonly baseUrl: string;
  readonly method: HttpMethod;
  /** A path such as `/v1/channels/:name`; each `:param` is filled from `params`, percent-encoded. */
  readonly path: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, QueryValue>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

/** The whole answer to one request. `json` is absent when the body is not JSON. */
export interface HttpResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly text: string;
  readonly json?: unknown;
}

/**
 * `url` without its trailing slashes, so the same server always has the same base URL.
 * @param url The server's URL as given.
 * @returns The base URL.
 */
export function baseUrlOf(url: string): string {
  return url.replace(TRAILING_SLASHES, "");
}

/**
 * Sends one request and reads the whole answer. A redirect is never followed,
 * so the headers (the token and the lease ID) go only to `baseUrl`: the
 * redirect itself is the answer.
 * @param options The request.
 * @returns The answer.
 */
export async function request(options: HttpRequest): Promise<HttpResponse> {
  const headers = new Headers({ accept: "application/json", ...options.headers });
  const init: RequestInit = { headers, method: options.method, redirect: "manual" };
  if ("body" in options) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(options.body);
  }
  const path = fillParams(options.path, options.params ?? {});
  const response = await fetch(`${baseUrlOf(options.baseUrl)}${path}${queryString(options.query ?? {})}`, init);
  const text = await response.text();
  return { headers: response.headers, ok: response.ok, status: response.status, text, ...parsed(text) };
}
