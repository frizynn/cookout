import { Effect, Layer, Option, Ref, Stream, SubscriptionRef } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import { nodeHttpServer, serverUrl } from "../../../http/server.ts";
import type { Scope } from "effect";

interface ReceivedCall {
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly path: string;
  readonly rawBody: string;
  readonly status: number;
}

interface Receiver {
  readonly calls: Effect.Effect<readonly ReceivedCall[]>;
  readonly failNext: (count: number, status: number) => Effect.Effect<void>;
  readonly url: string;
  readonly waitForCalls: (count: number) => Effect.Effect<readonly ReceivedCall[]>;
}

const OK = 200;
const FIRST_FAILURE = 400;
const LISTEN = { host: "127.0.0.1", port: 0 } as const;

function nextStatus(queued: readonly number[]): readonly [number, readonly number[]] {
  const [status = OK, ...rest] = queued;
  return [status, rest];
}

const receiver: Effect.Effect<Receiver, never, Scope.Scope> = Effect.gen(function* startReceiver() {
  const calls = yield* SubscriptionRef.make<readonly ReceivedCall[]>([]);
  const failures = yield* Ref.make<readonly number[]>([]);

  const receive = Effect.gen(function* receiveCall() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const rawBody = yield* Effect.orDie(request.text);
    const body = yield* Effect.option(request.json);
    const status = yield* Ref.modify(failures, nextStatus);
    const call: ReceivedCall = {
      body: Option.getOrUndefined(body),
      headers: request.headers,
      method: request.method,
      path: request.url,
      rawBody,
      status,
    };
    yield* SubscriptionRef.update(calls, (before) => [...before, call]);
    return HttpServerResponse.jsonUnsafe({ ok: status < FIRST_FAILURE }, { status });
  });

  function failNext(count: number, status: number): Effect.Effect<void> {
    const more = Array.from({ length: count }, () => status);
    return Ref.update(failures, (queued) => [...queued, ...more]);
  }

  function waitForCalls(count: number): Effect.Effect<readonly ReceivedCall[]> {
    return SubscriptionRef.changes(calls).pipe(
      Stream.filter((received) => received.length >= count),
      Stream.runHead,
      Effect.map(Option.getOrThrow),
    );
  }

  const serving = HttpServer.serve(receive).pipe(Layer.provideMerge(nodeHttpServer(LISTEN)));
  const server = yield* Layer.build(serving);
  const url = yield* Effect.provideContext(serverUrl, server);
  return { calls: SubscriptionRef.get(calls), failNext, url, waitForCalls };
}).pipe(Effect.orDie);

export { type ReceivedCall, receiver };
