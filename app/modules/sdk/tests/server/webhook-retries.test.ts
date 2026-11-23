import { Array as Arr, Effect } from "effect";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { MessageId } from "../../index.ts";
import { TestClock } from "effect/testing";
import type { TestCookoutService } from "../../../testing/server.ts";
import type { WebhookCall } from "../../../webhook-fake/server.ts";

const TWO_FAILURES = 2;
const THREE_CALLS = 3;
const SIX_CALLS = 6;
const UNAVAILABLE = 503;
const OK = 200;
const schema = { properties: { branch: { type: "string" } }, required: ["branch"], type: "object" };
const patientCookout = testCookout({ webhookTimeoutSeconds: 86_400 });

function advanceUntilCalls(cookout: TestCookoutService, count: number): Effect.Effect<readonly WebhookCall[]> {
  const step = Effect.andThen(TestClock.adjust("5 seconds"), TestClock.withLive(Effect.sleep("1 millis")));
  return Effect.raceFirst(cookout.webhook.waitForCalls(count), Effect.forever(step));
}

function calledDeploy(cookout: TestCookoutService): Effect.Effect<MessageId> {
  return Effect.gen(function* callDeploy() {
    yield* answer(() => cookout.client.addCommand({ name: "deploy", schema, url: `${cookout.webhook.url}/deploy` }));
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    const called = yield* answer(() =>
      cookout.client.callCommand("deploy", { channel: "grill", data: { branch: "main" } }),
    );
    return called.threadId;
  });
}

it.effect("a handler that fails twice is retried with the same call ID and then succeeds", () =>
  Effect.gen(function* failsTwice() {
    const cookout = yield* TestCookout;
    yield* cookout.webhook.failNext(TWO_FAILURES, UNAVAILABLE);
    const threadId = yield* calledDeploy(cookout);
    yield* advanceUntilCalls(cookout, THREE_CALLS);
    const calls = yield* Effect.andThen(TestClock.adjust("1 hour"), cookout.webhook.calls);
    const { replies } = yield* answer(() => cookout.client.getThread(threadId));
    const body = {
      callId: "call_test_4",
      command: "deploy",
      data: { branch: "main" },
      threadId,
      token: "cookout_test_3",
    };

    expect(Arr.map(calls, ({ status }) => status)).toStrictEqual([UNAVAILABLE, UNAVAILABLE, OK]);
    expect(Arr.map(calls, (call) => call.body)).toStrictEqual(Arr.replicate(body, THREE_CALLS));
    expect(replies).toStrictEqual([]);
  }).pipe(Effect.provide(patientCookout)),
);

it.effect("a handler that always fails gets 5 retries, then a failure reply appears in the thread", () =>
  Effect.gen(function* alwaysFails() {
    const cookout = yield* TestCookout;
    yield* cookout.webhook.failNext(SIX_CALLS, UNAVAILABLE);
    const threadId = yield* calledDeploy(cookout);
    yield* advanceUntilCalls(cookout, SIX_CALLS);
    const thread = yield* answer(() => cookout.client.getThread(threadId)).pipe(
      Effect.repeat({ until: ({ replies }) => Arr.isReadonlyArrayNonEmpty(replies) }),
    );
    yield* TestClock.adjust("1 day");
    const calls = yield* cookout.webhook.calls;

    expect(Arr.map(calls, (call) => call.body)).toMatchObject(
      Arr.replicate({ callId: "call_test_4", threadId }, SIX_CALLS),
    );
    expect(thread.replies).toMatchObject([
      {
        author: { name: "deploy" },
        kind: "reply",
        replyTo: threadId,
        text: "The delivery of /deploy to its handler failed after 5 retries.",
      },
    ]);
  }).pipe(Effect.provide(patientCookout)),
);
