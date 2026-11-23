/**
 * The example handler's HTTP server. `GET /health` answers 200. `POST
 * /webhook` takes a command call from the cookout: one whose
 * `cookout-signature` header is not the hex HMAC-SHA256 of the raw
 * body, keyed with the command's secret, gets 401 and goes no further; a
 * signed body that is not a command call gets 400. A signed command call is
 * answered 202 at once, and then the handler posts its result reply in the
 * call's thread with the call's command token, through the SDK. A body over 2 MiB gets 413 before it is read
 * whole or its signature checked: twice the cookout's own 1 MiB cap on a call, so a delivery always fits. A call
 * whose data has `failFirst: true` gets 503 on its first delivery, so the
 * cookout retries it with the same `callId`; a `callId` already handled is
 * answered 202 again and not handled twice. Each signed command call and its
 * status are handed to `onCall`. Anything else gets 404.
 */
import { ByteSize, Effect, FiberSet, Layer, Option, Redacted, Ref, Result, Schema } from "effect";
import {
  HttpIncomingMessage,
  HttpServer,
  HttpServerRequest,
  HttpServerRespondable,
  HttpServerResponse,
} from "effect/http";
import { Mac, SecureRandom } from "effect/crypto";
import type { CommandCall } from "./lib/server/call.ts";
import { CommandCallSchema } from "./lib/server/call.ts";
import { Hex } from "effect/encoding";
import { NodeHttpServer } from "@effect/platform-node";
import type { ServeError } from "effect/http/HttpServerError";
import { createCookoutClient } from "@ai-hero/cookout/sdk";
import { createServer } from "node:http";

interface HandlerOptions {
  readonly cookoutUrl: string;
  readonly host: string;
  readonly onCall: (call: CommandCall, status: number) => Effect.Effect<void>;
  readonly port: number;
  readonly secret: Redacted.Redacted;
}

type Decision = "fail" | "handle" | "repeat";

type Seen = ReadonlyMap<string, "failed" | "handled">;

type Receive = (call: CommandCall) => Effect.Effect<number>;

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
const UNAVAILABLE = 503;
const SIGNATURE_HEADER = "cookout-signature";
const TWO_MEBIBYTES = 2_097_152;
const maxBodySize = ByteSize.bytes(TWO_MEBIBYTES);
const utf8 = new TextEncoder();
const commandCallIn = Schema.decodeUnknownOption(Schema.fromJsonString(CommandCallSchema));
const isFailFirst = Schema.is(Schema.Struct({ failFirst: Schema.Literal(true) }));
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

function decide(call: CommandCall): (seen: Seen) => readonly [Decision, Seen] {
  return (seen) => {
    if (seen.get(call.callId) === "handled") {
      return ["repeat", seen];
    }
    if (!seen.has(call.callId) && isFailFirst(call.data)) {
      return ["fail", new Map([...seen, [call.callId, "failed"]])];
    }
    return ["handle", new Map([...seen, [call.callId, "handled"]])];
  };
}

function postResult(cookoutUrl: string, call: CommandCall): Effect.Effect<void> {
  const cookout = createCookoutClient({ token: call.token, url: cookoutUrl });
  const reply = {
    channel: call.channel,
    data: { received: call.data },
    replyTo: call.threadId,
    text: `/${call.command} is done.`,
  };
  return Effect.tryPromise({ catch: () => call.callId, try: () => cookout.createMessage(reply) }).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.logWarning(`The result reply for call ${call.callId} could not be posted.`),
      onSuccess: () => Effect.void,
    }),
  );
}

function webhook(options: HandlerOptions, receive: Receive): Answer {
  return Effect.gen(function* receiveWebhook() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const rawBody = yield* request.text;
    const signed = yield* isSignedBy(rawBody, request.headers[SIGNATURE_HEADER] ?? "", options.secret);
    if (!signed) {
      return status(UNAUTHORIZED);
    }
    const call = commandCallIn(rawBody);
    if (Option.isNone(call)) {
      return status(BAD_REQUEST);
    }
    const answered = yield* receive(call.value);
    return status(answered);
  }).pipe(
    Effect.catchTag("HttpServerError", HttpServerRespondable.toResponse),
    Effect.provideService(HttpIncomingMessage.MaxBodySize, maxBodySize),
  );
}

function answer(options: HandlerOptions, receive: Receive): Answer {
  return Effect.gen(function* route() {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (request.method === "GET" && request.url === "/health") {
      return status(OK);
    }
    if (request.method === "POST" && request.url === "/webhook") {
      return yield* webhook(options, receive);
    }
    return status(NOT_FOUND);
  });
}

export type { HandlerOptions };

/**
 * The handler's server as a Layer: it listens on `options.host` and
 * `options.port` (0 for a free port) until the Layer's scope closes, and
 * stops any result reply still being posted then.
 * @param options Where to listen, the command's secret, where the cookout is, and who to tell of each call.
 * @returns The running server.
 */
export function handlerServer(options: HandlerOptions): Layer.Layer<HttpServer.HttpServer, ServeError> {
  const listen = { disablePreemptiveShutdown: true, host: options.host, port: options.port };
  const serving = Layer.unwrap(
    Effect.gen(function* startHandling() {
      const replies = yield* FiberSet.make();
      const seen = yield* Ref.make<Seen>(new Map());
      function receive(call: CommandCall): Effect.Effect<number> {
        return Effect.gen(function* receiveCall() {
          const decision = yield* Ref.modify(seen, decide(call));
          if (decision === "fail") {
            yield* options.onCall(call, UNAVAILABLE);
            return UNAVAILABLE;
          }
          if (decision === "handle") {
            yield* FiberSet.run(replies, postResult(options.cookoutUrl, call));
          }
          yield* options.onCall(call, ACCEPTED);
          return ACCEPTED;
        });
      }
      return HttpServer.serve(answer(options, receive));
    }),
  ).pipe(Layer.provide(macLayer));
  return Layer.provideMerge(serving, NodeHttpServer.layer(createServer, listen));
}

/** The base URL a running `handlerServer` answers on, such as `http://127.0.0.1:54321`. */
export const handlerUrl: Effect.Effect<string, never, HttpServer.HttpServer> = Effect.map(
  HttpServer.HttpServer,
  (server) => HttpServer.formatAddress(server.address),
);
