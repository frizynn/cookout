import { DateTime, Effect } from "effect";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import type { TestIdentity } from "../../../testing/server.ts";
import { clockStoppedAt } from "../clock.ts";
import { inPane } from "../regions.ts";
import { openAt } from "../render.tsx";

function post(poster: TestIdentity, text: string): Effect.Effect<unknown> {
  return answer(() => poster.client.createMessage({ channel: "quiet", text }));
}

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
  yield* answer(() => cookout.client.createChannel({ name: "quiet" }));
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
