import { Array as Arr, Effect, Option, String as Str } from "effect";
import type { InboxResponse, Presence, TriggerResponse, TriggerResult } from "../../index.ts";
import { TestCookout, answer, testCookout, triggerToken } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";

const AGENT = "triage";
const OTHER = "reviewer";
const HUMAN = { kind: "human" } as const;
const TOKEN = "routine-secret";
const URL_OF = "https://routines.example.com/fire";
const PUBLIC_URL = "https://cookout.example.com";
const AT = "2026-01-01T00:00:00.000Z";
const OK = 200;
const NOT_FOUND = 404;
const SERVER_ERROR = 503;
const UNREACHABLE = "the trigger URL couldn't be reached";
const ONCE = 1;
const TWICE = 2;
const THRICE = 3;

interface Board {
  readonly cookout: TestCookoutService;
  readonly matt: TestIdentity;
  readonly ada: TestIdentity;
  readonly agent: TestIdentity;
}

const board: Effect.Effect<Board, never, TestCookout> = Effect.gen(function* boardWithATriggeredAgent() {
  const cookout = yield* TestCookout;
  const matt = yield* cookout.createIdentity("matt", HUMAN);
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  const agent = yield* cookout.createIdentity(AGENT, { owner: "matt" });
  yield* cookout.createIdentity(OTHER, { owner: "matt" });
  yield* answer(() => matt.client.createChannel({ name: "grill" }));
  yield* answer(() => matt.client.setTrigger(AGENT, { token: TOKEN, url: URL_OF }));
  return { ada, agent, cookout, matt };
});

const tick = TestClock.withLive(Effect.sleep("5 millis"));

function lastResultIn({ trigger }: TriggerResponse): Option.Option<TriggerResult> {
  return Option.flatMap(Option.fromNullishOr(trigger), ({ lastResult }) => Option.fromNullishOr(lastResult));
}

function settled({ matt }: Board, matches: (result: TriggerResult) => boolean): Effect.Effect<TriggerResponse> {
  return answer(() => matt.client.getTrigger(AGENT)).pipe(
    Effect.tap(() => tick),
    Effect.repeat({ until: (answered) => Option.exists(lastResultIn(answered), matches) }),
  );
}

function anyResult(): boolean {
  return true;
}

function failed({ ok }: TriggerResult): boolean {
  return !ok;
}

function succeeded({ ok }: TriggerResult): boolean {
  return ok;
}

function withStatus(status: number): (result: TriggerResult) => boolean {
  return (result) => result.status === status;
}

function presenceOf({ matt }: Board): Effect.Effect<Option.Option<Presence>> {
  return Effect.map(
    answer(() => matt.client.presence()),
    ({ presence }) => Arr.findFirst(presence, ({ identity }) => identity === AGENT),
  );
}

function presenceUntil(on: Board, until: (presence: Presence) => boolean): Effect.Effect<Option.Option<Presence>> {
  return presenceOf(on).pipe(
    Effect.tap(() => tick),
    Effect.repeat({ until: (seen) => Option.exists(seen, until) }),
  );
}

function mention({ ada }: Board, text = `@${AGENT} look`): Effect.Effect<number> {
  return Effect.map(
    answer(() => ada.client.createMessage({ channel: "grill", text })),
    ({ message }) => message.id,
  );
}

function mentionSettling(on: Board, matches: (result: TriggerResult) => boolean): Effect.Effect<number> {
  return Effect.tap(mention(on), () => settled(on, matches));
}

function inboxOf({ matt }: Board): Effect.Effect<InboxResponse> {
  return answer(() => matt.client.inbox());
}

it.effect("a mention POSTs the message's link and text to the trigger URL with the token, and stores the result", () =>
  Effect.gen(function* callOnMention() {
    const on = yield* board;
    const id = yield* Effect.map(mention(on), String);
    const calls = yield* on.cookout.triggers.waitForCalls(ONCE);
    const stored = yield* settled(on, anyResult);

    expect(calls).toStrictEqual([
      {
        text: `${PUBLIC_URL}/#/channels/grill/threads/${id}/messages/${id}\n\n@${AGENT} look`,
        token: triggerToken(TOKEN),
        url: URL_OF,
      },
    ]);
    expect(stored).toStrictEqual({ trigger: { lastResult: { at: AT, ok: true, status: OK }, url: URL_OF } });
  }).pipe(Effect.provide(testCookout({ publicUrl: PUBLIC_URL, triggers: "scripted" }))),
);

it.effect("the call goes through the HTTP client as a POST of JSON { text } with the token as a bearer", () =>
  Effect.gen(function* realCall() {
    const on = yield* board;
    yield* answer(() => on.matt.client.setTrigger(AGENT, { token: TOKEN, url: `${on.cookout.webhook.url}/fire` }));
    yield* mention(on);
    const calls = yield* on.cookout.webhook.waitForCalls(ONCE);
    const made = Arr.map(calls, ({ body, headers, method, path }) => ({
      authorization: headers["authorization"],
      body,
      method,
      path,
    }));

    expect(made).toStrictEqual([
      {
        authorization: `Bearer ${TOKEN}`,
        body: { text: `/#/channels/grill/threads/1/messages/1\n\n@${AGENT} look` },
        method: "POST",
        path: "/fire",
      },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect(
  "no call for the agent's own message, a human, an agent with no trigger URL, or after the URL is cleared",
  () =>
    Effect.gen(function* noCall() {
      const on = yield* board;
      yield* answer(() => on.agent.client.createMessage({ channel: "grill", text: `@${AGENT} note to self` }));
      yield* mention(on, `@matt @${OTHER} look`);
      yield* answer(() => on.matt.client.clearTrigger(AGENT));
      yield* mention(on);
      yield* answer(() => on.matt.client.setTrigger(OTHER, { token: TOKEN, url: URL_OF }));
      yield* mention(on, `@${OTHER} now`);
      const calls = yield* on.cookout.triggers.waitForCalls(ONCE);

      expect(Arr.map(calls, ({ text }) => Str.endsWith(`@${OTHER} now`)(text))).toStrictEqual([true]);
    }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a Deactivated agent is never called, and is called again once reactivated", () =>
  Effect.gen(function* deactivatedNotCalled() {
    const on = yield* board;
    yield* answer(() => on.matt.client.deactivateIdentity(AGENT));
    yield* mention(on);
    const asleep = yield* presenceOf(on);
    yield* answer(() => on.matt.client.reactivateIdentity(AGENT));
    yield* mention(on, `@${AGENT} back`);
    const calls = yield* on.cookout.triggers.waitForCalls(ONCE);

    expect(asleep).toStrictEqual(Option.some({ identity: AGENT, online: false }));
    expect(Arr.map(calls, ({ text }) => Str.endsWith(`@${AGENT} back`)(text))).toStrictEqual([true]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a trigger URL that doesn't answer is given up after 10 s, and never holds up the post", () =>
  Effect.gen(function* slowUrl() {
    const on = yield* board;
    yield* on.cookout.triggers.answerNext(["no answer"]);
    yield* mention(on);
    yield* on.cookout.triggers.waitForCalls(ONCE);
    const before = yield* answer(() => on.matt.client.getTrigger(AGENT));
    yield* TestClock.adjust("10 seconds");
    const after = yield* settled(on, anyResult);

    expect([before, after]).toStrictEqual([
      { trigger: { url: URL_OF } },
      { trigger: { lastResult: { at: AT, error: "no answer within 10 s", ok: false }, url: URL_OF } },
    ]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

const throughAStreak = Effect.gen(function* failThenSucceed() {
  const on = yield* board;
  const waking = yield* presenceOf(on);
  yield* on.cookout.triggers.answerNext([{ status: SERVER_ERROR }]);
  yield* mentionSettling(on, failed);
  const unreachable = yield* presenceOf(on);
  yield* mentionSettling(on, succeeded);
  const recovered = yield* presenceOf(on);
  yield* answer(() => on.matt.client.clearTrigger(AGENT));
  const cleared = yield* presenceOf(on);
  return Arr.getSomes([waking, unreachable, recovered, cleared]);
});

it.effect(
  "an agent with a trigger URL wakes on mention, turns Unreachable when a call fails, and green on the next success",
  () =>
    Effect.gen(function* presenceTransitions() {
      const seen = yield* throughAStreak;

      expect(seen).toStrictEqual([
        { identity: AGENT, online: true, wakesOnMention: true },
        { identity: AGENT, online: false, unreachable: { at: AT, ok: false, status: SERVER_ERROR }, warning: true },
        { identity: AGENT, online: true, wakesOnMention: true },
        { identity: AGENT, online: false },
      ]);
    }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

const liveThenGone = Effect.gen(function* joinWhileUnreachable() {
  const on = yield* board;
  yield* on.cookout.triggers.answerNext([{ error: UNREACHABLE }]);
  yield* mentionSettling(on, failed);
  const joined = yield* Effect.map(
    answer(() => on.matt.client.join({ as: AGENT })),
    ({ agentSessionToken }) => on.cookout.clientFor(agentSessionToken),
  );
  const events = yield* answer(() => joined.watch());
  const live = yield* presenceUntil(on, ({ online }) => online);
  yield* answer(() => joined.leave());
  yield* answer(() => events.close());
  const left = yield* presenceUntil(on, ({ online }) => !online);
  return { left: Option.getOrThrow(left), live: Option.getOrThrow(live) };
});

it.effect("a live connection turns an Unreachable agent green, and it shows Unreachable again once it leaves", () =>
  Effect.gen(function* liveBeatsUnreachable() {
    const { left, live } = yield* liveThenGone;

    expect(live).toMatchObject({ connection: {}, online: true });
    expect(live).not.toHaveProperty("unreachable");
    expect(left).toMatchObject({ online: false, unreachable: { at: AT, error: UNREACHABLE, ok: false } });
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

const streakInboxes = Effect.gen(function* failTwiceThenSucceed() {
  const on = yield* board;
  yield* on.cookout.triggers.answerNext([{ status: NOT_FOUND }, { status: SERVER_ERROR }]);
  const first = yield* mentionSettling(on, withStatus(NOT_FOUND));
  yield* mentionSettling(on, withStatus(SERVER_ERROR));
  const streak = yield* inboxOf(on);
  const elsewhere = yield* answer(() => on.ada.client.inbox());
  yield* mentionSettling(on, succeeded);
  const after = yield* inboxOf(on);
  return { after, elsewhere, first, streak };
});

it.effect("a failure streak raises one alert in the owner's inbox, and the next success clears it", () =>
  Effect.gen(function* oneAlertPerStreak() {
    const { after, elsewhere, first, streak } = yield* streakInboxes;

    expect(Arr.map(streak.alerts, ({ offlineReason, trigger }) => ({ offlineReason, trigger }))).toStrictEqual([
      { offlineReason: "trigger failed", trigger: { message: first, status: NOT_FOUND } },
    ]);
    expect(elsewhere.alerts).toStrictEqual([]);
    expect(Arr.map(after.alerts, ({ backOnlineAt }) => backOnlineAt)).toStrictEqual([AT]);
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);

it.effect("a new streak after a success raises a new alert", () =>
  Effect.gen(function* secondStreak() {
    const on = yield* board;
    yield* on.cookout.triggers.answerNext([{ status: SERVER_ERROR }, { status: OK }, { status: SERVER_ERROR }]);
    yield* Effect.forEach([failed, succeeded, failed], (matches) => mentionSettling(on, matches), { concurrency: 1 });
    const calls = yield* on.cookout.triggers.calls;
    const inbox = yield* inboxOf(on);

    expect(calls).toHaveLength(THRICE);
    expect(Arr.map(inbox.alerts, ({ offlineReason }) => offlineReason)).toStrictEqual(
      Arr.makeBy(TWICE, () => "trigger failed"),
    );
  }).pipe(Effect.provide(testCookout({ triggers: "scripted" }))),
);
