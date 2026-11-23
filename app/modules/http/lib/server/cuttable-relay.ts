import { Context, Effect, Layer, Option, Stream, SubscriptionRef } from "effect";
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
import { relayCutPath, relayRestorePath } from "../../index.ts";
import type { Scope } from "effect";
import { layerNodeHttp as nodeHttpClient } from "@effect/platform-node/NodeHttpClient";
import { layer as nodeHttpLayer } from "@effect/platform-node/NodeHttpServer";
import { serverDroppingSilentConnections } from "./node-http-server.ts";

interface CuttableRelay {
  readonly url: string;
  readonly cut: Effect.Effect<void>;
  readonly restore: Effect.Effect<void>;
}

interface Link {
  readonly target: string;
  readonly set: (up: boolean) => Effect.Effect<void>;
  readonly when: (up: boolean) => Effect.Effect<void>;
  readonly execute: (
    request: HttpClientRequest.HttpClientRequest,
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>;
}

type Answer = Effect.Effect<HttpServerResponse.HttpServerResponse, never, HttpServerRequest.HttpServerRequest>;

const LOOPBACK = { host: "127.0.0.1", port: 0 } as const;
const NO_CONTENT = 204;
const NOT_FORWARDED = ["connection", "content-length", "host", "origin", "transfer-encoding"] as const;
const endToEnd = Headers.removeMany(NOT_FORWARDED);
const controls: ReadonlyMap<string, boolean> = new Map([
  [relayCutPath, false],
  [relayRestorePath, true],
]);

function forwarded(
  link: Link,
  method: HttpMethod.HttpMethod,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  HttpServerError.HttpServerError | HttpClientError.HttpClientError,
  HttpServerRequest.HttpServerRequest
> {
  return Effect.gen(function* forward() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const sent = yield* request.arrayBuffer;
    yield* link.when(true);
    const outgoing = HttpClientRequest.make(method)(`${link.target}${request.url}`).pipe(
      HttpClientRequest.setHeaders(endToEnd(request.headers)),
      HttpClientRequest.bodyUint8Array(new Uint8Array(sent), request.headers["content-type"]),
    );
    const answer = yield* link.execute(outgoing);
    const body = Stream.interruptWhen(answer.stream, link.when(false));
    return HttpServerResponse.stream(body, { headers: endToEnd(answer.headers), status: answer.status });
  });
}

function relayed(link: Link): Answer {
  return Effect.gen(function* relayRequest() {
    const { method, url } = yield* HttpServerRequest.HttpServerRequest;
    const control = controls.get(url);
    if (method === "POST" && typeof control === "boolean") {
      yield* link.set(control);
      return HttpServerResponse.empty({ status: NO_CONTENT });
    }
    const known = yield* Effect.fromOption(Option.liftPredicate(method, HttpMethod.isHttpMethod));
    return yield* forwarded(link, known);
  }).pipe(Effect.orDie);
}

function cuttableRelay(target: string): Effect.Effect<CuttableRelay, never, Scope.Scope> {
  return Effect.gen(function* openRelay() {
    const client = yield* Effect.map(Layer.build(nodeHttpClient), Context.get(HttpClient.HttpClient));
    const up = yield* SubscriptionRef.make(true);
    const changes = SubscriptionRef.changes(up);
    const link: Link = {
      execute: client.execute,
      set: (now) => SubscriptionRef.set(up, now),
      target,
      when: (wanted) =>
        changes.pipe(
          Stream.filter((now) => now === wanted),
          Stream.runHead,
          Effect.asVoid,
        ),
    };
    const { dropSilent, server: node } = serverDroppingSilentConnections();
    const listening = nodeHttpLayer(() => node, { ...LOOPBACK, disablePreemptiveShutdown: true });
    const serving = HttpServer.serve(relayed(link)).pipe(Layer.provideMerge(listening));
    const server = yield* Effect.map(Layer.build(serving), Context.get(HttpServer.HttpServer));
    yield* Effect.addFinalizer(() => dropSilent);
    return { cut: link.set(false), restore: link.set(true), url: HttpServer.formatAddress(server.address) };
  }).pipe(Effect.orDie);
}

export { cuttableRelay };
