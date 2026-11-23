/**
 * The cookout's HTTP server on Node's HTTP server: routing, `/v1/health`, the
 * body size limit, the web guards, and the one place a failure becomes an
 * `{ error }` body. A handler fails with a `Refusal` to answer with it;
 * storage, body and path failures are answered by kind, and anything else is
 * a 500. Given a web folder, it also serves the built web UI: `index.html` at
 * `/` and the build's files under `/assets/`, with no token.
 */
import { ByteSize, DateTime, Effect, Layer, Option, Path } from "effect";
import { ErrorResponseSchema, HealthResponseSchema, SchemaProblemsSchema, securityHeaders } from "./lib/server/wire.ts";
import type { Gate, Route } from "./lib/server/router.ts";
import { HttpIncomingMessage, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import { guardRefusal, notFound, respond, toRefusal } from "./lib/server/refusals.ts";
import type { HttpPlatform } from "effect/http";
import { NodeHttpServer } from "@effect/platform-node";
import type { Refusal } from "./index.ts";
import { Storage } from "../storage/server.ts";
import { createServer } from "node:http";
import { dispatch } from "./lib/server/router.ts";
import { healthPath } from "./index.ts";
import { isoTimeOf } from "../time/server.ts";

interface Listen {
  readonly host: string;
  readonly port: number;
}

interface Serving extends Listen {
  readonly webFolder?: string;
  readonly publicUrl?: string;
}

type NodeHttp = ReturnType<typeof NodeHttpServer.layer>;

const MEBIBYTE = 1_048_576;
const maxBodySize = ByteSize.bytes(MEBIBYTE);

const healthRoute: Route<Storage> = {
  handle: () =>
    Effect.gen(function* healthCheck() {
      const storage = yield* Storage;
      yield* storage.checkHealth();
      const now = yield* DateTime.now;
      const time = isoTimeOf(now);
      return yield* HttpServerResponse.schemaJson(HealthResponseSchema)({ status: "ok", time });
    }),
  method: "GET",
  path: healthPath,
};

type WebNeeds = HttpPlatform.HttpPlatform | Path.Path;

const ASSET_NAME = /^[\w-][\w.-]*$/u;

function isAssetName(segment: string): boolean {
  return ASSET_NAME.test(segment);
}

function webFile(
  webFolder: string,
  urlPath: string,
  file: readonly string[],
): Effect.Effect<HttpServerResponse.HttpServerResponse, Refusal, WebNeeds> {
  return Effect.gen(function* serveWebFile() {
    const path = yield* Path.Path;
    return yield* HttpServerResponse.file(path.join(webFolder, ...file));
  }).pipe(Effect.catchTag("PlatformError", () => Effect.fail(notFound("GET", urlPath))));
}

function webRoutesIn(webFolder: string): readonly Route<WebNeeds>[] {
  return [
    { handle: () => webFile(webFolder, "/", ["index.html"]), method: "GET", path: "/" },
    {
      handle: ({ file = "" }) => webFile(webFolder, `/assets/${file}`, ["assets", file]),
      method: "GET",
      path: "/assets/:file",
      segments: { file: isAssetName },
    },
  ];
}

function webRoutes({ webFolder }: Serving): readonly Route<WebNeeds>[] {
  return Option.match(Option.fromNullishOr(webFolder), { onNone: () => [], onSome: webRoutesIn });
}

function answerFailure(failure: unknown): Effect.Effect<HttpServerResponse.HttpServerResponse> {
  return respond(toRefusal(failure));
}

function guardRequest(
  publicUrl: string,
): Effect.Effect<void, Refusal, HttpServerRequest.HttpServerRequest | HttpServer.HttpServer> {
  return Effect.gen(function* guardHostAndOrigin() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const server = yield* HttpServer.HttpServer;
    const { host = "", origin = "" } = request.headers;
    const address = HttpServer.formatAddress(server.address);
    const refused = guardRefusal({ address, host, method: request.method, origin, publicUrl });
    return yield* Option.match(refused, { onNone: () => Effect.void, onSome: Effect.fail });
  });
}

export type { Gate, Route } from "./lib/server/router.ts";
export type { Listen, Serving };

/** The response Schemas of `/v1/health`, of every refusal and of an `invalid_request` refusal's details, for the SDK's generated validators. */
export const httpResponseSchemas = {
  ErrorResponse: ErrorResponseSchema,
  HealthResponse: HealthResponseSchema,
  SchemaProblems: SchemaProblemsSchema,
};

/**
 * Node's HTTP server on `listen`, for any `HttpServer.serve` app: the one
 * place `node:http` is opened. Port 0 picks a free port; the server closes
 * with the Layer's scope.
 * @internal
 * @param listen The port and host to listen on.
 * @returns The `HttpServer` and Node's HTTP platform.
 */
export function nodeHttpServer(listen: Listen): NodeHttp {
  return NodeHttpServer.layer(createServer, { ...listen, disablePreemptiveShutdown: true });
}

/**
 * Serves `/v1/health` and the given routes on `listen` until the Layer is
 * released. A route's `segments` give the pattern each named `:param`
 * segment must match; a path that breaks one is no route's (404
 * `not_found`). Every request to a path one of `routes` serves goes through
 * `gate` first, before a wrong method is refused with 405; `/v1/health` and
 * unknown paths (404) never do. The `HttpServer` it provides says which
 * address it took: port 0 picks a free one. With a `webFolder`, `/` answers
 * with its `index.html` and `/assets/<file>` with its `assets/<file>`, also
 * without the gate; a file the folder lacks is 404 `not_found`. Every request
 * goes through the web guards first: a `Host` that isn't the server's own
 * (or the host of `publicUrl`) is refused with 421 `foreign_host`, a write from another site's `Origin` with
 * 403 `foreign_origin`, and every response carries a strict CSP and refuses framing.
 * @param serving The port and host to listen on, the folder of the built web UI if it serves one, and the public URL if it has one.
 * @param routes Every route but `/v1/health`.
 * @param gate What every request to one of `routes` goes through first.
 * @returns The server, as a Layer.
 */
export function httpServer<Needs, Provides, Requires, Fails>(
  serving: Serving,
  routes: readonly Route<Needs>[],
  gate: Gate<Provides, Requires, Fails>,
) {
  const { host, port, publicUrl = "" } = serving;
  const open: readonly Route<Storage | WebNeeds>[] = [healthRoute, ...webRoutes(serving)];
  const app = Effect.andThen(guardRequest(publicUrl), dispatch({ gate, gated: routes, open })).pipe(
    Effect.catch(answerFailure),
    Effect.map(HttpServerResponse.setHeaders(securityHeaders)),
    Effect.provideService(HttpIncomingMessage.MaxBodySize, maxBodySize),
  );
  return Layer.provideMerge(HttpServer.serve(app), nodeHttpServer({ host, port }));
}

/** The base URL a running `httpServer` answers on, such as `http://127.0.0.1:54321`. */
export const serverUrl: Effect.Effect<string, never, HttpServer.HttpServer> = Effect.map(
  HttpServer.HttpServer,
  (server) => HttpServer.formatAddress(server.address),
);
