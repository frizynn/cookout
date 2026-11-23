import { Boolean as Bool, Context, Deferred, Effect, Layer, Ref, String as Str, Stream, SubscriptionRef } from "effect";
import { Headers, HttpClient, HttpClientRequest, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { HttpClientError, HttpClientResponse } from "effect/http";
import { nodeHttpServer, serverUrl } from "../../../http/server.ts";
import { NodeHttpClient } from "@effect/platform-node";
import type { Scope } from "effect";

interface CuttableLink {
  readonly url: string;
  readonly cut: Effect.Effect<void>;
  readonly stall: Effect.Effect<void>;
  readonly relayed: (text: string, times?: number) => Effect.Effect<void>;
}

interface Signal {
  readonly fire: Effect.Effect<void>;
  readonly current: Effect.Effect<Deferred.Deferred<boolean>>;
}

interface Relay {
  readonly target: string;
  readonly dropped: Effect.Effect<Effect.Effect<boolean>>;
  readonly stalled: Effect.Effect<Effect.Effect<boolean>>;
  readonly record: (text: string) => Effect.Effect<void>;
  readonly execute: (
    request: HttpClientRequest.HttpClientRequest,
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>;
}

const LISTEN = { host: "127.0.0.1", port: 0 } as const;
const ONCE = 1;
const HOP_BY_HOP = ["connection", "content-length", "host", "transfer-encoding"] as const;
const endToEnd = Headers.removeMany(HOP_BY_HOP);

const signal: Effect.Effect<Signal> = Effect.gen(function* makeSignal() {
  const first = yield* Deferred.make<boolean>();
  const signals = yield* Ref.make(first);
  const fire = Effect.gen(function* fireSignal() {
    const next = yield* Deferred.make<boolean>();
    const current = yield* Ref.getAndSet(signals, next);
    yield* Deferred.succeed(current, true);
  });
  return { current: Ref.get(signals), fire };
});

function relayed(
  relay: Relay,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest> {
  return Effect.gen(function* relayRequest() {
    const { headers, url } = yield* HttpServerRequest.HttpServerRequest;
    const dropped = yield* relay.dropped;
    const stalled = yield* relay.stalled;
    const forwarded = HttpClientRequest.get(`${relay.target}${url}`).pipe(
      HttpClientRequest.setHeaders(endToEnd(headers)),
    );
    const answer = yield* relay.execute(forwarded);
    const body = answer.stream.pipe(
      Stream.decodeText(),
      Stream.filterEffect(() => Effect.map(stalled, Bool.not)),
      Stream.interruptWhen(dropped),
      Stream.tap(relay.record),
      Stream.encodeText,
    );
    return HttpServerResponse.stream(body, { headers: endToEnd(answer.headers), status: answer.status });
  }).pipe(Effect.orDie);
}

function serving(relay: Relay): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* serveRelay() {
    const relaying = HttpServer.serve(relayed(relay)).pipe(Layer.provideMerge(nodeHttpServer(LISTEN)));
    const server = yield* Layer.build(relaying);
    return yield* Effect.provideContext(serverUrl, server);
  }).pipe(Effect.orDie);
}

function sentAtLeast(text: string, times: number): (sent: string) => boolean {
  return (sent) => Str.split(text)(sent).length > times;
}

function cuttableLink(target: string): Effect.Effect<CuttableLink, never, Scope.Scope> {
  return Effect.gen(function* openLink() {
    const client = yield* Effect.map(Layer.build(NodeHttpClient.layerNodeHttp), Context.get(HttpClient.HttpClient));
    const drops = yield* signal;
    const stalls = yield* signal;
    const sent = yield* SubscriptionRef.make("");
    const changes = SubscriptionRef.changes(sent);
    const relay: Relay = {
      dropped: Effect.map(drops.current, Deferred.await),
      execute: client.execute,
      record: (text) => SubscriptionRef.update(sent, Str.concat(text)),
      stalled: Effect.map(stalls.current, Deferred.isDone),
      target,
    };
    const url = yield* serving(relay);
    return {
      cut: drops.fire,
      relayed: (text: string, times = ONCE) =>
        changes.pipe(Stream.filter(sentAtLeast(text, times)), Stream.runHead, Effect.asVoid),
      stall: stalls.fire,
      url,
    };
  }).pipe(Effect.orDie);
}

export { type CuttableLink, cuttableLink };
