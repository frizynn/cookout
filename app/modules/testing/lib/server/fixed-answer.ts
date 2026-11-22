import { Effect, Layer } from "effect";
import { HttpServer, HttpServerResponse } from "effect/http";
import { nodeHttpServer, serverUrl } from "../../../http/server.ts";
import type { Scope } from "effect";

const LISTEN = { host: "127.0.0.1", port: 0 } as const;

function serverAnswering(body: unknown): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* startFixedServer() {
    const serving = HttpServer.serve(Effect.succeed(HttpServerResponse.jsonUnsafe(body))).pipe(
      Layer.provideMerge(nodeHttpServer(LISTEN)),
    );
    const server = yield* Layer.build(serving);
    return yield* Effect.provideContext(serverUrl, server);
  }).pipe(Effect.orDie);
}

export { serverAnswering };
