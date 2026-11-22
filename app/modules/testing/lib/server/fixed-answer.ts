import { Effect, Layer } from "effect";
import { HttpServer, HttpServerResponse } from "effect/http";
import { nodeHttpServer, serverUrl } from "../../../http/server.ts";
import type { Scope } from "effect";

interface Answered {
  readonly headers?: Readonly<Record<string, string>>;
  readonly status?: number;
}

type FixedAnswer = Answered & ({ readonly body: unknown } | { readonly text: string });

const LISTEN = { host: "127.0.0.1", port: 0 } as const;
const OK = 200;

function responseFor(answer: FixedAnswer): HttpServerResponse.HttpServerResponse {
  const { headers = {}, status = OK } = answer;
  if ("text" in answer) {
    return HttpServerResponse.text(answer.text, { headers, status });
  }
  return HttpServerResponse.jsonUnsafe(answer.body, { headers, status });
}

function serverAnswering(answer: FixedAnswer): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* startFixedServer() {
    const response = responseFor(answer);
    const serving = HttpServer.serve(Effect.succeed(response)).pipe(Layer.provideMerge(nodeHttpServer(LISTEN)));
    const server = yield* Layer.build(serving);
    const url = yield* Effect.provideContext(serverUrl, server);
    return url;
  }).pipe(Effect.orDie);
}

export { type FixedAnswer, serverAnswering };
