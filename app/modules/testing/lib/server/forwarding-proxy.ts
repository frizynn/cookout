import { Effect, Layer, Record, Ref, String as Str } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import { nodeHttpServer, serverUrl } from "../../../http/server.ts";
import { Agent } from "undici";
import type { Scope } from "effect";

interface ForwardingProxy {
  readonly url: string;
  readonly forwarded: Effect.Effect<readonly string[]>;
}

const FORWARDED = new Set(["accept", "authorization", "content-type"]);
const LISTEN = { host: "127.0.0.1", port: 0 } as const;
const NO_BODY = {};

function bodyOf(text: string): { readonly body?: string } {
  if (Str.isEmpty(text)) {
    return NO_BODY;
  }
  return { body: text };
}

function isForwarded(_value: string, name: string): boolean {
  return FORWARDED.has(name);
}

function forwardingProxy(target: string): Effect.Effect<ForwardingProxy, never, Scope.Scope> {
  return Effect.gen(function* startForwardingProxy() {
    const seen = yield* Ref.make<readonly string[]>([]);
    const direct = yield* Effect.sync(() => new Agent());
    yield* Effect.addFinalizer(() => Effect.promise(() => direct.close()));
    const forward = Effect.gen(function* forwardRequest() {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const { pathname, search } = new URL(request.url, target);
      yield* Ref.update(seen, (all) => [...all, `${request.method} ${pathname}`]);
      const text = yield* request.text;
      const answered = yield* Effect.promise(() =>
        direct.request({
          ...bodyOf(text),
          headers: Record.filter(request.headers, isForwarded),
          method: request.method,
          origin: target,
          path: `${pathname}${search}`,
        }),
      );
      const body = yield* Effect.promise(() => answered.body.text());
      return HttpServerResponse.text(body, {
        contentType: String(answered.headers["content-type"]),
        status: answered.statusCode,
      });
    }).pipe(Effect.orDie);
    const serving = HttpServer.serve(forward).pipe(Layer.provideMerge(nodeHttpServer(LISTEN)));
    const server = yield* Effect.orDie(Layer.build(serving));
    const url = yield* Effect.provideContext(serverUrl, server);
    return { forwarded: Ref.get(seen), url };
  });
}

export { type ForwardingProxy, forwardingProxy };
