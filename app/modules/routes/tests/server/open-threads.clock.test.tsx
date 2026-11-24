import { Clock, DateTime, Effect } from "effect";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { listShows, openLive } from "../open-threads.ts";
import { TestClock } from "effect/testing";
import type { TestIdentity } from "../../../testing/server.ts";
import { clockStoppedAt } from "../clock.ts";
import { inPane } from "../regions.ts";
import { openAt } from "../render.tsx";

const CHANNEL = "quiet";
const STEP_BACK_MILLIS = 108;

function post(poster: TestIdentity, text: string): Effect.Effect<unknown> {
  return answer(() => poster.client.createMessage({ channel: CHANNEL, text }));
}

const stepBack = Effect.flatMap(Clock.currentTimeMillis, (now) => TestClock.setTime(now - STEP_BACK_MILLIS));

const steppedBackThreads = Effect.gen(function* postAcrossAStepBack() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", { kind: "human" });
  const grace = yield* cookout.createIdentity("grace", { kind: "human" });
  yield* answer(() => cookout.client.createChannel({ name: CHANNEL }));
  const { message: first } = yield* answer(() => ada.client.createMessage({ channel: CHANNEL, text: "First." }));
  yield* Effect.andThen(stepBack, post(ada, "Second."));
  yield* TestClock.adjust("1 second");
  return { ada, first, grace };
});

it.effect("a reply by another identity moves its thread to the end live, though the clock stepped back", () =>
  Effect.gen(function* replyMovesThread() {
    const { ada, first, grace } = yield* steppedBackThreads;
    const close = yield* answer(() => openLive({ client: ada.client, hash: "#/threads" }));
    yield* answer(() => listShows({ channel: CHANNEL, texts: ["First.", "Second."] }));
    yield* answer(() => grace.client.createMessage({ channel: CHANNEL, replyTo: first.id, text: "Bump." }));

    yield* answer(() => listShows({ channel: CHANNEL, texts: ["Second.", "First."] }));

    yield* answer(close);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a close by another identity drops a row live, and a reopen brings it back at the end", () =>
  Effect.gen(function* reopenMovesThread() {
    const { ada, first, grace } = yield* steppedBackThreads;
    const close = yield* answer(() => openLive({ client: ada.client, hash: "#/threads" }));
    yield* answer(() => listShows({ channel: CHANNEL, texts: ["First.", "Second."] }));
    yield* answer(() => grace.client.closeThread(first.id));
    yield* answer(() => listShows({ channel: CHANNEL, texts: ["Second."] }));
    yield* answer(() => grace.client.reopenThread(first.id));

    yield* answer(() => listShows({ channel: CHANNEL, texts: ["Second.", "First."] }));

    yield* answer(close);
  }).pipe(Effect.provide(testCookout())),
);

function quietTimes(): readonly string[] {
  const list = inPane().getByRole("list", { name: "Open threads" });
  const times: string[] = [];
  for (const row of list.querySelectorAll("li")) {
    const [quiet = ""] = /quiet for [\w ]+?(?=ada)/u.exec(row.textContent) ?? [];
    times.push(quiet);
  }
  return times;
}

const quietThreads = Effect.gen(function* postQuietThreads() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", { kind: "human" });
  yield* answer(() => cookout.client.createChannel({ name: CHANNEL }));
  yield* post(ada, "Anyone?");
  yield* Effect.andThen(TestClock.adjust("93 hours"), post(ada, "Hours ago."));
  yield* Effect.andThen(TestClock.adjust("179 minutes"), post(ada, "A minute ago."));
  return ada;
});

it.effect("a thread last active 4 days ago reads quiet for 4 days, and fresher ones in hours and minutes", () =>
  Effect.gen(function* quietForDays() {
    const ada = yield* quietThreads;
    yield* TestClock.adjust("1 minute");
    const now = yield* DateTime.now;
    clockStoppedAt(DateTime.formatIso(now));
    openAt({ client: ada.client, hash: "#/threads" });

    yield* answer(() => inPane().findByText("quiet for 4 days"));

    expect(quietTimes()).toStrictEqual(["quiet for 4 days", "quiet for 3 hours", "quiet for 1 minute"]);
  }).pipe(Effect.provide(testCookout())),
);
