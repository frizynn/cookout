import { Array as Arr, Effect, Layer, Option } from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Hex } from "effect/encoding";
import type { TestCookoutService } from "../../../testing/server.ts";
import type { WebhookCall } from "../../../webhook-fake/server.ts";

const ONE_CALL = 1;
const TWO_CALLS = 2;
const UNAVAILABLE = 503;
const schema = { properties: { branch: { type: "string" } }, required: ["branch"], type: "object" };
const utf8 = new TextEncoder();
const macLayer = Layer.provide(Mac.layerWebCrypto, SecureRandom.layerWebCrypto);

function signatureOf({ rawBody }: WebhookCall, secret: string): Effect.Effect<string> {
  return Effect.gen(function* sign() {
    const mac = yield* Mac.Mac;
    const key = yield* Mac.key(Mac.hmacSha256, utf8.encode(secret));
    const tag = yield* mac.sign(key, utf8.encode(rawBody));
    return Hex.encode(tag);
  }).pipe(Effect.provide(macLayer), Effect.orDie);
}

function firstCall(cookout: TestCookoutService): Effect.Effect<WebhookCall> {
  return Effect.map(cookout.webhook.waitForCalls(ONE_CALL), (calls) => Option.getOrThrow(Arr.head(calls)));
}

function withDeployInGrill(cookout: TestCookoutService): Effect.Effect<string> {
  return Effect.gen(function* addDeploy() {
    const { secret } = yield* answer(() =>
      cookout.client.addCommand({ name: "deploy", schema, url: `${cookout.webhook.url}/deploy` }),
    );
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    return secret;
  });
}

it.effect("after a good call the handler gets the call, signed with the command's secret", () =>
  Effect.gen(function* signedDelivery() {
    const cookout = yield* TestCookout;
    const secret = yield* withDeployInGrill(cookout);
    const called = yield* answer(() =>
      cookout.client.callCommand("deploy", { channel: "grill", data: { branch: "main" } }),
    );
    const call = yield* firstCall(cookout);
    const signature = yield* signatureOf(call, secret);

    expect(call).toMatchObject({
      body: {
        callId: "call_test_4",
        channel: "grill",
        command: "deploy",
        data: { branch: "main" },
        threadId: called.threadId,
        token: "cookout_test_3",
      },
      headers: { "content-type": "application/json", "cookout-signature": signature },
      method: "POST",
      path: "/deploy",
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("each call has its own call ID and command token, and a failed delivery doesn't fail the call", () =>
  Effect.gen(function* twoCalls() {
    const cookout = yield* TestCookout;
    yield* withDeployInGrill(cookout);
    yield* cookout.webhook.failNext(ONE_CALL, UNAVAILABLE);
    const first = yield* answer(() =>
      cookout.client.callCommand("deploy", { channel: "grill", data: { branch: "main" } }),
    );
    yield* cookout.webhook.waitForCalls(ONE_CALL);
    const second = yield* answer(() =>
      cookout.client.callCommand("deploy", { channel: "grill", data: { branch: "next" } }),
    );
    const calls = yield* cookout.webhook.waitForCalls(TWO_CALLS);

    expect(calls).toMatchObject([
      { body: { callId: "call_test_4", threadId: first.threadId, token: "cookout_test_3" }, status: UNAVAILABLE },
      { body: { callId: "call_test_6", threadId: second.threadId, token: "cookout_test_5" } },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a running cookout signs each delivery with the command's random secret, in lowercase hex", () =>
  Effect.gen(function* liveSignature() {
    const cookout = yield* TestCookout;
    const secret = yield* withDeployInGrill(cookout);
    yield* answer(() => cookout.client.callCommand("deploy", { channel: "grill", data: { branch: "main" } }));
    const call = yield* firstCall(cookout);
    const signature = yield* signatureOf(call, secret);

    expect(signature).toMatch(/^[0-9a-f]{64}$/u);
    expect(call.headers).toMatchObject({ "cookout-signature": signature });
    expect(call.rawBody).toMatch(/"callId":"call_[A-Za-z0-9_-]{22}"/u);
  }).pipe(Effect.provide(testCookout({ secrets: "live" }))),
);
