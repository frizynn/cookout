import { Effect, Layer } from "effect";
import { HttpServer, HttpServerResponse } from "effect/http";
import { nodeHttpServer, serverUrl } from "../../../http/server.ts";
import type { Scope } from "effect";

interface FixedAnswer {
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly status?: number;
}

const LISTEN = { host: "127.0.0.1", port: 0 } as const;
const OK = 200;

function serverAnswering({ body, headers = {}, status = OK }: FixedAnswer): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* startFixedServer() {
    const response = HttpServerResponse.jsonUnsafe(body, { headers, status });
    const serving = HttpServer.serve(Effect.succeed(response)).pipe(Layer.provideMerge(nodeHttpServer(LISTEN)));
    const server = yield* Layer.build(serving);
    const url = yield* Effect.provideContext(serverUrl, server);
    return url;
  }).pipe(Effect.orDie);
}

export { type FixedAnswer, serverAnswering };
