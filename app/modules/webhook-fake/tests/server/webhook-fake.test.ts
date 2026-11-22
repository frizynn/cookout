import { Effect, Fiber, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { WebhookFake, webhookFake } from "../../server.ts";
import { expect, it } from "@effect/vitest";

const OK = 200;
const UNAVAILABLE = 503;
const FAILURES = 2;
const WAITED_FOR = 2;
const layers = Layer.mergeAll(webhookFake, FetchHttpClient.layer);

function post(url: string, body: unknown): Effect.Effect<number, never, HttpClient.HttpClient> {
  return HttpClientRequest.post(url).pipe(
    HttpClientRequest.setHeader("x-cookout-test", "yes"),
    HttpClientRequest.bodyJsonUnsafe(body),
    HttpClient.execute,
    Effect.map((response) => response.status),
    Effect.orDie,
  );
}

it.effect("the fake webhook receiver records each call", () =>
  Effect.gen(function* recordsCalls() {
    const fake = yield* WebhookFake;
    const status = yield* post(`${fake.url}/hooks/deploy`, { command: "deploy" });
    const calls = yield* fake.calls;

    expect(status).toBe(OK);
    expect(calls).toMatchObject([
      {
        body: { command: "deploy" },
        headers: { "content-type": "application/json", "x-cookout-test": "yes" },
        method: "POST",
        path: "/hooks/deploy",
        rawBody: '{"command":"deploy"}',
        status: OK,
      },
    ]);
  }).pipe(Effect.provide(layers)),
);

it.effect("the fake webhook receiver can be told to fail the next calls", () =>
  Effect.gen(function* failsNextCalls() {
    const fake = yield* WebhookFake;
    yield* fake.failNext(FAILURES, UNAVAILABLE);
    const first = yield* post(fake.url, "one");
    const second = yield* post(fake.url, "two");
    const third = yield* post(fake.url, "three");
    const calls = yield* fake.calls;

    expect([first, second, third]).toStrictEqual([UNAVAILABLE, UNAVAILABLE, OK]);
    expect(calls).toMatchObject([{ status: UNAVAILABLE }, { status: UNAVAILABLE }, { status: OK }]);
  }).pipe(Effect.provide(layers)),
);

it.effect("the fake webhook receiver can wait for calls that have not arrived yet", () =>
  Effect.gen(function* waitsForCalls() {
    const fake = yield* WebhookFake;
    const waiting = yield* Effect.forkChild(fake.waitForCalls(WAITED_FOR));
    yield* post(fake.url, "a");
    yield* post(fake.url, "b");
    const arrived = yield* Fiber.join(waiting);

    expect(arrived).toMatchObject([{ body: "a" }, { body: "b" }]);
  }).pipe(Effect.provide(layers)),
);
