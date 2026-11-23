import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { builtWebFolder, freshDatabasePath, startServeWithWeb } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { NodeServices } from "@effect/platform-node";
import { secretsLive } from "../../../secrets/server.ts";

interface Fetched {
  readonly body: string;
  readonly contentType: string;
  readonly status: number;
}

const OK = 200;
const isRefusal = Schema.is(Schema.Struct({ error: Schema.Struct({ code: Schema.String }) }));

function fetched(url: string): Effect.Effect<Fetched> {
  return Effect.gen(function* fetchPage() {
    const response = yield* HttpClient.execute(HttpClientRequest.get(url));
    const body = yield* response.text;
    return { body, contentType: response.headers["content-type"] ?? "", status: response.status };
  }).pipe(Effect.provide(FetchHttpClient.layer), Effect.orDie);
}

function refusalCode(url: string): Effect.Effect<string> {
  return Effect.gen(function* fetchRefusal() {
    const response = yield* HttpClient.execute(HttpClientRequest.get(url));
    const body = yield* response.json;
    if (isRefusal(body)) {
      return `${String(response.status)} ${body.error.code}`;
    }
    return expect.unreachable(String(response.status));
  }).pipe(Effect.provide(FetchHttpClient.layer), Effect.orDie);
}

it.effect("cookout serve serves the built web UI's index.html at / and its assets next to it", () =>
  Effect.gen(function* servesTheWebUi() {
    const web = yield* builtWebFolder;
    const database = yield* freshDatabasePath;
    const server = yield* startServeWithWeb({ database, webFolder: web.folder });
    const page = yield* fetched(`${server.url}/`);
    const script = yield* fetched(`${server.url}${web.scriptPath}`);

    expect(page).toStrictEqual({ body: web.indexHtml, contentType: "text/html", status: OK });
    expect(script).toStrictEqual({ body: web.scriptText, contentType: "text/javascript", status: OK });
  }).pipe(Effect.provide([NodeServices.layer, secretsLive])),
);

it.effect("an asset the build doesn't have, or a path out of the build's folder, is not found", () =>
  Effect.gen(function* missingAssets() {
    const web = yield* builtWebFolder;
    const database = yield* freshDatabasePath;
    const server = yield* startServeWithWeb({ database, webFolder: web.folder });
    const missing = yield* refusalCode(`${server.url}/assets/missing.js`);
    const escaping = yield* refusalCode(`${server.url}/assets/..%2Findex.html`);

    expect(missing).toBe("404 not_found");
    expect(escaping).toBe("404 not_found");
  }).pipe(Effect.provide([NodeServices.layer, secretsLive])),
);

it.effect("a cookout whose web UI isn't built answers / with not_found", () =>
  Effect.gen(function* unbuiltWebUi() {
    const database = yield* freshDatabasePath;
    const server = yield* startServeWithWeb({ database, webFolder: `${database}-no-web-build` });
    const page = yield* refusalCode(`${server.url}/`);

    expect(page).toBe("404 not_found");
  }).pipe(Effect.provide([NodeServices.layer, secretsLive])),
);
