import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { request } from "../../http/client.ts";
import { startWebhookFake } from "../server.ts";

const webhookFake = Effect.acquireRelease(Effect.promise(startWebhookFake), (fake) => Effect.promise(fake.stop));

const post = (baseUrl: string, body: unknown, path = "/") =>
  Effect.promise(() =>
    request({ baseUrl, method: "POST", path, headers: { "x-cookout-test": "yes" }, body }).then(
      (response) => response.status,
    ),
  );

it.effect("the fake webhook receiver records each call", () =>
  Effect.gen(function* () {
    const fake = yield* webhookFake;
    expect(yield* post(fake.url, { command: "deploy" }, "/hooks/deploy")).toBe(200);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls).toMatchObject([
      {
        method: "POST",
        path: "/hooks/deploy",
        rawBody: '{"command":"deploy"}',
        body: { command: "deploy" },
        headers: { "x-cookout-test": "yes", "content-type": "application/json" },
        status: 200,
      },
    ]);
  }),
);

it.effect("the fake webhook receiver can be told to fail the next calls", () =>
  Effect.gen(function* () {
    const fake = yield* webhookFake;
    fake.failNext(2, 503);
    const statuses = [yield* post(fake.url, 1), yield* post(fake.url, 2), yield* post(fake.url, 3)];
    expect(statuses).toEqual([503, 503, 200]);
    expect(fake.calls.map((call) => call.status)).toEqual([503, 503, 200]);
  }),
);

it.effect("the fake webhook receiver can wait for calls that have not arrived yet", () =>
  Effect.gen(function* () {
    const fake = yield* webhookFake;
    const arrived = fake.waitForCalls(2);
    yield* post(fake.url, "a");
    yield* post(fake.url, "b");
    expect((yield* Effect.promise(() => arrived)).map((call) => call.body)).toEqual(["a", "b"]);
  }),
);
