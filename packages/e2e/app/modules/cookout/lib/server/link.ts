import { Context, Deferred, Effect, Layer, Ref, String as Str, Stream, SubscriptionRef } from "effect";
import {
  Headers,
  HttpClient,
  HttpClientRequest,
  HttpMethod,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import type { HttpClientError, HttpClientResponse, HttpServerError } from "effect/http";
import { NodeHttpClient, NodeHttpServer } from "@effect/platform-node";
import type { Scope } from "effect";

interface Answered {
  readonly method: string;
  readonly path: string;
  readonly status: number;
}

interface Link {
  readonly url: string;
  readonly cut: Effect.Effect<void>;
  readonly takeDown: Effect.Effect<void>;
  readonly bringUp: Effect.Effect<void>;
  readonly relayed: (text: string, times?: number) => Effect.Effect<void>;
  readonly lastEventIds: Effect.Effect<readonly (string | null)[]>;
  readonly answered: Effect.Effect<readonly Answered[]>;
}

interface Relay {
  readonly target: string;
  readonly isDown: Effect.Effect<boolean>;
  readonly dropped: Effect.Effect<Effect.Effect<boolean>>;
  readonly record: (text: string) => Effect.Effect<void>;
  readonly opened: (request: HttpServerRequest.HttpServerRequest) => Effect.Effect<void>;
  readonly answer: (answered: Answered) => Effect.Effect<void>;
  readonly execute: (
    request: HttpClientRequest.HttpClientRequest,
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>;
}

const ONCE = 1;
const BAD_GATEWAY = 502;
const EVENTS_PATH = "/v1/events";
const HOP_BY_HOP = ["connection", "content-length", "host", "transfer-encoding"] as const;
const endToEnd = Headers.removeMany(HOP_BY_HOP);

function forwardedTo(
  target: string,
  method: HttpMethod.HttpMethod,
): Effect.Effect<
  HttpClientRequest.HttpClientRequest,
  HttpServerError.HttpServerError,
  HttpServerRequest.HttpServerRequest
> {
  return Effect.gen(function* forwardRequest() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const sent = yield* request.arrayBuffer;
    return HttpClientRequest.make(method)(`${target}${request.url}`).pipe(
      HttpClientRequest.setHeaders(endToEnd(request.headers)),
      HttpClientRequest.bodyUint8Array(new Uint8Array(sent), request.headers["content-type"]),
    );
  });
}

function relayed(
  relay: Relay,
): Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest> {
  return Effect.gen(function* relayRequest() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const { method } = request;
    if ((yield* relay.isDown) || !HttpMethod.isHttpMethod(method)) {
      return HttpServerResponse.empty({ status: BAD_GATEWAY });
    }
    yield* relay.opened(request);
    const dropped = yield* relay.dropped;
    const answer = yield* Effect.flatMap(forwardedTo(relay.target, method), relay.execute);
    yield* relay.answer({ method, path: request.url, status: answer.status });
    const body = answer.stream.pipe(
      Stream.decodeText(),
      Stream.interruptWhen(dropped),
      Stream.tap(relay.record),
      Stream.encodeText,
    );
    return HttpServerResponse.stream(body, { headers: endToEnd(answer.headers), status: answer.status });
  }).pipe(Effect.orDie);
}

function serving(relay: Relay): Effect.Effect<string, never, Scope.Scope> {
  return Effect.gen(function* serveRelay() {
    const relaying = HttpServer.serve(relayed(relay)).pipe(Layer.provideMerge(NodeHttpServer.layerTest));
    const server = yield* Layer.build(relaying);
    return HttpServer.formatAddress(Context.get(server, HttpServer.HttpServer).address);
  }).pipe(Effect.orDie);
}

function sentAtLeast(text: string, times: number): (sent: string) => boolean {
  return (sent) => Str.split(text)(sent).length > times;
}

function lastEventIdOf(request: HttpServerRequest.HttpServerRequest): string | null {
  return request.headers["last-event-id"] ?? null;
}

function link(target: string): Effect.Effect<Link, never, Scope.Scope> {
  return Effect.gen(function* openLink() {
    const client = yield* Effect.map(Layer.build(NodeHttpClient.layerNodeHttp), Context.get(HttpClient.HttpClient));
    const drops = yield* Effect.flatMap(Deferred.make<boolean>(), Ref.make);
    const sent = yield* SubscriptionRef.make("");
    const down = yield* Ref.make(false);
    const opened = yield* Ref.make<readonly (string | null)[]>([]);
    const answers = yield* Ref.make<readonly Answered[]>([]);
    const cut = Effect.gen(function* dropAll() {
      const next = yield* Deferred.make<boolean>();
      const current = yield* Ref.getAndSet(drops, next);
      yield* Deferred.succeed(current, true);
    });
    const relay: Relay = {
      answer: (answered) => Ref.update(answers, (all) => [...all, answered]),
      dropped: Effect.map(Ref.get(drops), Deferred.await),
      execute: client.execute,
      isDown: Ref.get(down),
      opened: (request) => {
        if (!Str.startsWith(EVENTS_PATH)(request.url)) {
          return Effect.void;
        }
        return Ref.update(opened, (ids) => [...ids, lastEventIdOf(request)]);
      },
      record: (text) => SubscriptionRef.update(sent, Str.concat(text)),
      target: Str.replace(/\/+$/u, "")(target),
    };
    const url = yield* serving(relay);
    return {
      answered: Ref.get(answers),
      bringUp: Ref.set(down, false),
      cut,
      lastEventIds: Ref.get(opened),
      relayed: (text: string, times = ONCE) =>
        SubscriptionRef.changes(sent).pipe(Stream.filter(sentAtLeast(text, times)), Stream.runHead, Effect.asVoid),
      takeDown: Effect.andThen(Ref.set(down, true), cut),
      url,
    };
  }).pipe(Effect.orDie);
}

export { type Answered, type Link, link };
