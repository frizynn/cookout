/**
 * The example handler's HTTP server. `GET /health` answers 200. `POST
 * /webhook` takes a command call from the cookout: one whose
 * `cookout-signature` header is not the hex HMAC-SHA256 of the raw
 * body, keyed with the command's secret, gets 401 and goes no further; a
 * signed body that is not a command call gets 400; a signed command call is
 * handed to `onCall` and answered 202. Anything else gets 404.
 */
import { Effect, Layer, Option, Redacted, Result, Schema } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import { Mac, SecureRandom } from "effect/crypto";
import type { CommandCall } from "./lib/server/call.ts";
import { CommandCallSchema } from "./lib/server/call.ts";
import { Hex } from "effect/encoding";
import { NodeHttpServer } from "@effect/platform-node";
import type { ServeError } from "effect/http/HttpServerError";
import { createServer } from "node:http";

interface HandlerOptions {
  readonly host: string;
  readonly onCall: (call: CommandCall) => Effect.Effect<void>;
  readonly port: number;
  readonly secret: Redacted.Redacted;
}

type Answer = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  HttpServerRequest.HttpServerRequest | Mac.Mac
>;

const OK = 200;
const ACCEPTED = 202;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const SIGNATURE_HEADER = "cookout-signature";
const utf8 = new TextEncoder();
const commandCallIn = Schema.decodeUnknownOption(Schema.fromJsonString(CommandCallSchema));
const macLayer = Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto));

function isSignedBy(
  rawBody: string,
  signature: string,
  secret: Redacted.Redacted,
): Effect.Effect<boolean, never, Mac.Mac> {
  return Effect.gen(function* checkSignature() {
    const tag = Hex.decode(signature);
    if (Result.isFailure(tag)) {
      return false;
    }
    const mac = yield* Mac.Mac;
    const key = yield* Mac.key(Mac.hmacSha256, utf8.encode(Redacted.value(secret)));
    return yield* mac.verify(key, tag.success, utf8.encode(rawBody));
  }).pipe(Effect.orDie);
}

function status(code: number): HttpServerResponse.HttpServerResponse {
  return HttpServerResponse.empty({ status: code });
}

function webhook(options: HandlerOptions): Answer {
  return Effect.gen(function* receiveWebhook() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const rawBody = yield* Effect.orDie(request.text);
    const signed = yield* isSignedBy(rawBody, request.headers[SIGNATURE_HEADER] ?? "", options.secret);
    if (!signed) {
      return status(UNAUTHORIZED);
    }
    const call = commandCallIn(rawBody);
    if (Option.isNone(call)) {
      return status(BAD_REQUEST);
    }
    yield* options.onCall(call.value);
    return status(ACCEPTED);
  });
}

function answer(options: HandlerOptions): Answer {
  return Effect.gen(function* route() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.method === "GET" && request.url === "/health") {
      return status(OK);
    }
    if (request.method === "POST" && request.url === "/webhook") {
      return yield* webhook(options);
    }
    return status(NOT_FOUND);
  });
}

export type { HandlerOptions };

/**
 * The handler's server as a Layer: it listens on `options.host` and
 * `options.port` (0 for a free port) until the Layer's scope closes.
 * @param options Where to listen, the command's secret, and what to do with each signed call.
 * @returns The running server.
 */
export function handlerServer(options: HandlerOptions): Layer.Layer<HttpServer.HttpServer, ServeError> {
  const listen = { disablePreemptiveShutdown: true, host: options.host, port: options.port };
  const serving = HttpServer.serve(answer(options)).pipe(Layer.provide(macLayer));
  return Layer.provideMerge(serving, NodeHttpServer.layer(createServer, listen));
}

/** The base URL a running `handlerServer` answers on, such as `http://127.0.0.1:54321`. */
export const handlerUrl: Effect.Effect<string, never, HttpServer.HttpServer> = Effect.map(
  HttpServer.HttpServer,
  (server) => HttpServer.formatAddress(server.address),
);
