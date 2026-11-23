import { DateTime, Effect } from "effect";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import { clockStoppedAt } from "../clock.ts";
import { inPane } from "../regions.ts";
import { openAt } from "../render.tsx";

it.effect("a thread last active 4 days ago reads quiet for 4 days", () =>
  Effect.gen(function* quietForDays() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", { kind: "human" });
    yield* answer(() => cookout.client.createChannel({ name: "quiet" }));
    yield* answer(() => ada.client.createMessage({ channel: "quiet", text: "Anyone?" }));
    yield* TestClock.adjust("4 days");
    const now = yield* DateTime.now;
    clockStoppedAt(DateTime.formatIso(now));
    openAt({ client: ada.client, hash: "#/threads" });

    const row = yield* answer(() => inPane().findByText("quiet for 4 days"));

    expect(row.textContent).toBe("quiet for 4 days");
  }).pipe(Effect.provide(testCookout())),
);
