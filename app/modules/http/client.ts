/**
 * The one owner of `fetch` and of URL and query-string building, for the SDK
 * and the web. It speaks HTTP and JSON and knows nothing of what the bodies mean.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequest = {
  readonly baseUrl: string;
  readonly method: HttpMethod;
  /** A path such as `/v1/channels/:name`; each `:param` is filled from `params`, percent-encoded. */
  readonly path: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string | number | undefined>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
};

export type HttpResponse = {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly text: string;
  readonly json: unknown;
};

const queryString = (query: HttpRequest["query"] = {}): string => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) search.set(name, String(value));
  }
  return search.size === 0 ? "" : `?${search.toString()}`;
};

const parseJson = (text: string): unknown => {
  if (text === "") return undefined;
  try {
    const json: unknown = JSON.parse(text);
    return json;
  } catch {
    return undefined;
  }
};

const fillParams = (path: string, params: HttpRequest["params"] = {}): string =>
  path.replaceAll(/:([A-Za-z]+)/gu, (_, name: string) => encodeURIComponent(params[name] ?? ""));

function urlFor(options: HttpRequest): string {
  const path = fillParams(options.path, options.params);
  return `${options.baseUrl.replace(/\/+$/, "")}${path}${queryString(options.query)}`;
}

/** Sends one request and reads the whole answer. A body that is not JSON reads as `undefined`. */
export async function request(options: HttpRequest): Promise<HttpResponse> {
  const headers = new Headers({ accept: "application/json", ...options.headers });
  const init: RequestInit = { method: options.method, headers };
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(urlFor(options), init);
  const text = await response.text();
  return { status: response.status, ok: response.ok, headers: response.headers, text, json: parseJson(text) };
}
