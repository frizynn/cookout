import { Array as Arr, Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { NodeHttpClient } from "@effect/platform-node";
import { channelsPath } from "../../../channels/index.ts";
import { healthPath } from "../../../http/index.ts";
import { request } from "../../../http/client.ts";

const OK = 200;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const MISDIRECTED = 421;
const FOREIGN_ORIGIN = "https://elsewhere.example";
const STRICT_POLICY = /^default-src 'none';.*frame-ancestors 'none'$/u;

function withHost(url: string, host: string): Effect.Effect<{ readonly json: unknown; readonly status: number }> {
  return Effect.gen(function* sendWithHost() {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.get(`${url}${healthPath}`).pipe(HttpClientRequest.setHeader("host", host)),
    );
    const json = yield* response.json;
    return { json, status: response.status };
  }).pipe(Effect.provide(NodeHttpClient.layerNodeHttp), Effect.orDie);
}

it.effect("a write whose Origin is another site's, or opaque, is refused with 403 foreign_origin", () =>
  Effect.gen(function* foreignOriginWrite() {
    const cookout = yield* TestCookout;
    const write = { baseUrl: cookout.url, body: { name: "general" }, method: "POST", path: channelsPath } as const;
    const foreign = yield* answer(() => request({ ...write, headers: { origin: FOREIGN_ORIGIN } }));
    const opaque = yield* answer(() => request({ ...write, headers: { origin: "null" } }));
    const own = yield* answer(() => request({ ...write, headers: { origin: cookout.url } }));

    expect(foreign.status).toBe(FORBIDDEN);
    expect([foreign.json, opaque.json]).toMatchObject([
      { error: { code: "foreign_origin" } },
      { error: { code: "foreign_origin" } },
    ]);
    expect(own.json).toMatchObject({ error: { code: "token_missing" } });
    expect(own.status).toBe(UNAUTHORIZED);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a read from another site's Origin is still answered", () =>
  Effect.gen(function* foreignOriginRead() {
    const cookout = yield* TestCookout;
    const read = yield* answer(() =>
      request({ baseUrl: cookout.url, headers: { origin: FOREIGN_ORIGIN }, method: "GET", path: healthPath }),
    );

    expect(read.status).toBe(OK);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a request whose Host isn't the server's own is refused with 421 foreign_host", () =>
  Effect.gen(function* foreignHost() {
    const cookout = yield* TestCookout;
    const { port } = new URL(cookout.url);
    const foreign = yield* withHost(cookout.url, `elsewhere.example:${port}`);
    const localhost = yield* withHost(cookout.url, `localhost:${port}`);

    expect(foreign).toMatchObject({ json: { error: { code: "foreign_host" } }, status: MISDIRECTED });
    expect(localhost.status).toBe(OK);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("every response carries a strict CSP without unsafe-inline and refuses framing", () =>
  Effect.gen(function* securityHeaders() {
    const cookout = yield* TestCookout;
    const health = yield* answer(() => request({ baseUrl: cookout.url, method: "GET", path: healthPath }));
    const missing = yield* answer(() => request({ baseUrl: cookout.url, method: "GET", path: "/v1/no-such-route" }));
    const refused = yield* answer(() =>
      request({ baseUrl: cookout.url, headers: { origin: FOREIGN_ORIGIN }, method: "DELETE", path: channelsPath }),
    );
    const responses = [health, missing, refused];
    const frames = Arr.map(responses, (response) => response.headers.get("x-frame-options"));
    const policies = Arr.map(responses, (response) => response.headers.get("content-security-policy") ?? "");

    expect(frames).toStrictEqual(["DENY", "DENY", "DENY"]);
    expect(Arr.every(policies, (policy) => STRICT_POLICY.test(policy))).toBe(true);
    expect(Arr.join(policies, " ")).not.toContain("unsafe-inline");
  }).pipe(Effect.provide(testCookout())),
);
