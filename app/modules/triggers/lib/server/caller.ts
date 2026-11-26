import { Array as Arr, Context, Effect, Function as Fn, Layer, Record, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import type { RouterAsk, RouterCallerService, RouterPick } from "../../../channels/server.ts";
import type { SessionWake, TriggerHeader, TriggerToken, WakeReason } from "../../index.ts";
import { RouterCaller } from "../../../channels/server.ts";
import type { TriggerAnswer } from "./answer.ts";
import { isOkStatus } from "../../index.ts";

interface TriggerWake {
  readonly channel: string;
  readonly thread: number;
  readonly message: number;
  readonly reason: WakeReason;
  readonly author: string;
  readonly wake?: SessionWake;
}

interface TriggerCall {
  readonly url: string;
  readonly token: TriggerToken;
  readonly headers: readonly TriggerHeader[];
  readonly text: string;
  readonly wake: TriggerWake;
}

interface TriggerCallerService {
  readonly call: (call: TriggerCall) => Effect.Effect<TriggerAnswer, string>;
}

class TriggerCaller extends Context.Service<TriggerCaller, TriggerCallerService>()(
  "@ai-hero/cookout/triggers/lib/server/caller/TriggerCaller",
) {}

const UNREACHABLE = "the trigger URL couldn't be reached";
const NO_MESSAGE = "";
const Envelope = Schema.Struct({ error: Schema.Struct({ message: Schema.String }) });

function messageOf(response: HttpClientResponse.HttpClientResponse): Effect.Effect<string> {
  return HttpClientResponse.schemaBodyJson(Envelope)(response).pipe(
    Effect.matchEffect({ onFailure: () => response.text, onSuccess: ({ error }) => Effect.succeed(error.message) }),
    Effect.orElseSucceed(Fn.constant(NO_MESSAGE)),
  );
}

function answerOf(response: HttpClientResponse.HttpClientResponse): Effect.Effect<TriggerAnswer> {
  const { status } = response;
  if (isOkStatus(status)) {
    return Effect.succeed({ message: NO_MESSAGE, status });
  }
  return Effect.map(messageOf(response), (message) => ({ message, status }));
}

function requestOf({ headers, text, token, url, wake }: TriggerCall): HttpClientRequest.HttpClientRequest {
  const extra = Record.fromEntries(Arr.map(headers, ({ name, value }) => [name, value] as const));
  return HttpClientRequest.post(url).pipe(
    HttpClientRequest.setHeaders(extra),
    HttpClientRequest.setHeader("authorization", `Bearer ${token}`),
    HttpClientRequest.bodyJsonUnsafe({ ...wake, text }),
  );
}

function callerOn(client: HttpClient.HttpClient): TriggerCallerService {
  return {
    call: (call) =>
      client.execute(requestOf(call)).pipe(
        Effect.mapError(() => UNREACHABLE),
        Effect.flatMap(answerOf),
        Effect.provideService(HttpClient.TracerPropagationEnabled, false),
      ),
  };
}

const Pick = Schema.Struct({ confidence: Schema.optionalKey(Schema.Finite), name: Schema.String });
const Picks = Schema.Struct({ agents: Schema.Array(Pick) });

function picksOf(response: HttpClientResponse.HttpClientResponse): Effect.Effect<readonly RouterPick[], string> {
  if (!isOkStatus(response.status)) {
    return Effect.fail(`the router answered ${String(response.status)}`);
  }
  return HttpClientResponse.schemaBodyJson(Picks)(response).pipe(
    Effect.mapBoth({
      onFailure: () => "the router's answer wasn't { agents: [{ name }] }",
      onSuccess: ({ agents }) => agents,
    }),
  );
}

function routerRequestOf({ body, signature, url }: RouterAsk): HttpClientRequest.HttpClientRequest {
  return HttpClientRequest.post(url).pipe(
    HttpClientRequest.setHeader("cookout-signature", signature),
    HttpClientRequest.bodyText(body, "application/json"),
  );
}

function routerOn(client: HttpClient.HttpClient): RouterCallerService {
  return {
    ask: (ask) =>
      client.execute(routerRequestOf(ask)).pipe(
        Effect.mapError(() => "the router couldn't be reached"),
        Effect.flatMap(picksOf),
        Effect.provideService(HttpClient.TracerPropagationEnabled, false),
      ),
  };
}

const neverRedirected = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" })),
);

const triggerCallerLive: Layer.Layer<TriggerCaller | RouterCaller> = Layer.effectContext(
  Effect.map(HttpClient.HttpClient, (client) =>
    Context.make(TriggerCaller, callerOn(client)).pipe(Context.add(RouterCaller, routerOn(client))),
  ),
).pipe(Layer.provide(neverRedirected));

export { type TriggerCall, TriggerCaller, type TriggerCallerService, type TriggerWake, triggerCallerLive };
