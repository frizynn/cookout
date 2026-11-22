/**
 * The cookout's HTTP server on Node's HTTP server: routing, `/v1/health`, the
 * body size limit, and the one place a failure becomes an `{ error }` body. A
 * handler fails with a `Refusal` to answer with it; storage, body and path
 * failures are answered by kind, and anything else is a 500.
 */
import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { ByteSize, DateTime, Effect, Layer } from "effect";
import { HttpIncomingMessage, HttpServer, HttpServerResponse } from "effect/http";
import { Storage } from "../storage/server.ts";
import { healthPath } from "./index.ts";
import { respond, toRefusal } from "./lib/server/refusals.ts";
import { dispatch, type Gate, type Route } from "./lib/server/router.ts";
import { ErrorResponseSchema, HealthResponseSchema } from "./lib/server/wire.ts";

export type { Gate, Route };

/** The response Schemas of `/v1/health` and of every refusal, for the SDK's generated validators. */
export const httpResponseSchemas = { HealthResponse: HealthResponseSchema, ErrorResponse: ErrorResponseSchema };

const maxBodySize = ByteSize.bytes(1024 * 1024);

const healthRoute: Route<Storage> = {
  method: "GET",
  path: healthPath,
  handle: () =>
    Effect.gen(function* () {
      const storage = yield* Storage;
      yield* storage.checkHealth();
      const time = DateTime.formatIso(yield* DateTime.now);
      return yield* HttpServerResponse.schemaJson(HealthResponseSchema)({ status: "ok", time });
    }),
};

export type Listen = { readonly port: number; readonly host: string };

/**
 * Serves `/v1/health` and the given routes on `listen` until the Layer is
 * released. Every request to a path one of `routes` serves goes through
 * `gate` first, before a wrong method is refused with 405; `/v1/health` and
 * unknown paths (404) never do. The `HttpServer` it provides says which
 * address it took: port 0 picks a free one.
 */
export const httpServer = <R, Provides, Needs>(
  listen: Listen,
  routes: ReadonlyArray<Route<R>>,
  gate: Gate<Provides, Needs>,
) =>
  HttpServer.serve(
    dispatch([healthRoute], routes, gate).pipe(
      Effect.catch((error) => respond(toRefusal(error))),
      Effect.provideService(HttpIncomingMessage.MaxBodySize, maxBodySize),
    ),
  ).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { ...listen, disablePreemptiveShutdown: true })));

/** The base URL a running `httpServer` answers on, such as `http://127.0.0.1:54321`. */
export const serverUrl: Effect.Effect<string, never, HttpServer.HttpServer> = Effect.map(
  HttpServer.HttpServer,
  (server) => HttpServer.formatAddress(server.address),
);
