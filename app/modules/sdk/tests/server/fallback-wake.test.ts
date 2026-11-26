import { Array as Arr, Effect, Option } from "effect";
import type { Message, MessageId } from "../../index.ts";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { TriggerCall } from "../../../triggers/server.ts";

const HUMAN = { kind: "human" } as const;
const FALLBACK = "night-shift";
const ROUTER = "https://router.example.com/route";
const TOKEN = "trigger-secret";
const ONCE = 1;
const TWICE = 2;
const UNPROCESSABLE = 422;
const WAKE = { effort: "high", harness: "claude", model: "sonnet" } as const;
const ROUTER_FAILS = { error: "the router answered 500" } as const;
const PI = {
  harnesses: [{ efforts: ["low"], label: "Pi", models: [{ label: "Pi Large", name: "pi-large" }], name: "pi" }],
};
const PI_ONLY =
  '{"harnesses":[{"efforts":["low"],"label":"Pi","models":[{"label":"Pi Large","name":"pi-large"}],"name":"pi"}]}';
const FIRST = 0;
const SECOND = 1;

interface Board {
  readonly cookout: TestCookoutService;
  readonly ada: TestIdentity;
  readonly fallback: TestIdentity;
}

const board: Effect.Effect<Board, never, TestCookout> = Effect.gen(function* boardWithFallback() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  const fallback = yield* cookout.createIdentity(FALLBACK, { owner: "ada" });
  yield* answer(() => cookout.client.createChannel({ name: "general" }));
  yield* answer(() => ada.client.setTrigger(FALLBACK, { token: TOKEN, url: `https://wake.example.com/${FALLBACK}` }));
  return { ada, cookout, fallback };
});

function wakeAt(calls: readonly TriggerCall[], index: number): TriggerCall["wake"] {
  return Option.getOrThrow(Arr.get(calls, index)).wake;
}

function post(who: TestIdentity, text: string): Effect.Effect<Message> {
  return Effect.map(
    answer(() => who.client.createMessage({ channel: "general", text })),
    ({ message }) => message,
  );
}

function replied(who: TestIdentity, parent: Message, seen: MessageId): Effect.Effect<Message> {
  return Effect.map(
    answer(() => who.client.createMessage({ channel: "general", replyTo: parent.id, seen, text: "and then?" })),
    ({ message }) => message,
  );
}

it.effect(
  "a fallback set to wake in a new session is called with the harness, model and effort, in its thread too",
  () =>
    Effect.gen(function* ephemeralFallback() {
      const on = yield* board;
      yield* answer(() =>
        on.cookout.client.setChannelRouting("general", { fallback: FALLBACK, fallbackWake: WAKE, router: ROUTER }),
      );
      yield* on.cookout.triggers.routeWith(ROUTER_FAILS);
      const message = yield* post(on.ada, "anyone around?");
      yield* on.cookout.triggers.waitForCalls(ONCE);
      const { message: answered } = yield* answer(() =>
        on.fallback.client.createMessage({ channel: "general", replyTo: message.id, text: "here" }),
      );
      yield* replied(on.ada, message, answered.id);
      const calls = yield* on.cookout.triggers.waitForCalls(TWICE);

      expect(wakeAt(calls, FIRST)).toStrictEqual({
        author: "ada",
        channel: "general",
        message: message.id,
        reason: "routed",
        thread: message.id,
        wake: { mode: "ephemeral", ...WAKE },
      });
      expect([wakeAt(calls, SECOND).reason, wakeAt(calls, SECOND).wake]).toStrictEqual([
        "thread",
        { mode: "ephemeral", ...WAKE },
      ]);
    }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a fallback with no wake is called as before, with no wake in the body", () =>
  Effect.gen(function* sessionFallback() {
    const on = yield* board;
    yield* answer(() => on.cookout.client.setChannelRouting("general", { fallback: FALLBACK, router: ROUTER }));
    yield* on.cookout.triggers.routeWith(ROUTER_FAILS);
    yield* post(on.ada, "anyone around?");
    const calls = yield* on.cookout.triggers.waitForCalls(ONCE);

    expect("wake" in wakeAt(calls, FIRST)).toBe(false);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("the router is asked with the fallback's wake beside the fallback", () =>
  Effect.gen(function* routerSeesWake() {
    const on = yield* board;
    yield* answer(() =>
      on.cookout.client.setChannelRouting("general", { fallback: FALLBACK, fallbackWake: WAKE, router: ROUTER }),
    );
    yield* post(on.ada, "who knows?");
    const asked = yield* Effect.map(on.cookout.triggers.routerCalls, (calls) => Option.getOrThrow(Arr.head(calls)));

    expect(asked.body).toContain(
      `"fallback":"${FALLBACK}","fallbackWake":{"effort":"high","harness":"claude","model":"sonnet"},"text":"who knows?"`,
    );
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a fallback's wake is kept on the channel, needs a fallback and must name listed options", () =>
  Effect.gen(function* checkedWake() {
    const on = yield* board;
    const admin = on.cookout.client;
    const set = yield* answer(() =>
      admin.setChannelRouting("general", { fallback: FALLBACK, fallbackWake: WAKE, router: ROUTER }),
    );
    const read = yield* answer(() => admin.getChannel("general"));
    const alone = yield* refusal(() => admin.setChannelRouting("general", { fallbackWake: WAKE, router: ROUTER }));
    const unlisted = yield* refusal(() =>
      admin.setChannelRouting("general", {
        fallback: FALLBACK,
        fallbackWake: { ...WAKE, model: "gpt-unknown" },
        router: ROUTER,
      }),
    );

    expect([set.channel.fallbackWake, read.channel.fallbackWake]).toStrictEqual([WAKE, WAKE]);
    expect([alone, unlisted]).toMatchObject([
      { code: "routing_conflict", status: UNPROCESSABLE },
      { code: "routing_wake_invalid", status: UNPROCESSABLE },
    ]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("the board's wake options default to Claude Code and Codex", () =>
  Effect.gen(function* defaults() {
    const cookout = yield* TestCookout;
    const { options } = yield* answer(() => cookout.client.wakeOptions());

    expect(Arr.map(options.harnesses, ({ name }) => name)).toStrictEqual(["claude", "codex"]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("COOKOUT_WAKE_OPTIONS replaces the wake options, and a fallback's wake is checked against them", () =>
  Effect.gen(function* configured() {
    const on = yield* board;
    const admin = on.cookout.client;
    const { options } = yield* answer(() => admin.wakeOptions());
    const pi = { effort: "low", harness: "pi", model: "pi-large" };
    const set = yield* answer(() =>
      admin.setChannelRouting("general", { fallback: FALLBACK, fallbackWake: pi, router: ROUTER }),
    );
    const claude = yield* refusal(() =>
      admin.setChannelRouting("general", { fallback: FALLBACK, fallbackWake: WAKE, router: ROUTER }),
    );

    expect(options).toStrictEqual(PI);
    expect([set.channel.fallbackWake, claude.code]).toStrictEqual([pi, "routing_wake_invalid"]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted", wakeOptions: PI_ONLY }))),
);
