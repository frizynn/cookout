import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Effect } from "effect";
import type { EventStream } from "../../../sdk/index.ts";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";
import type { TestIdentity } from "../../../testing/server.ts";
import { openAt } from "../render.tsx";
import { watched } from "../watched.ts";

const NUDGE = "Quiet for 3 days: close it, or follow up?";
const SETTLE = "30 millis";
const HUMAN = { kind: "human" } as const;
const TWO = 2;

const settled: Effect.Effect<void> = TestClock.withLive(Effect.sleep(SETTLE));

function pageOpenFor(who: TestIdentity): Effect.Effect<void, never, Scope.Scope> {
  return Effect.gen(function* openPage() {
    const { live, stream } = watched(who.client);
    openAt({ client: who.client, hash: "#/inbox", live });
    yield* Effect.acquireRelease(
      answer(() => stream),
      (events: EventStream) => answer(() => events.close()),
    );
  });
}

function textsOf(elements: Iterable<Readonly<{ textContent: string }>>): readonly string[] {
  const texts: string[] = [];
  for (const element of elements) {
    texts.push(element.textContent);
  }
  return texts;
}

const twoPagesNudged: Effect.Effect<void, never, TestCookout | Scope.Scope> = Effect.gen(function* nudgeAdaTwice() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  yield* answer(() => ada.client.createChannel({ name: "grill" }));
  yield* answer(() => ada.client.createMessage({ channel: "grill", text: "Who owns the release notes?" }));
  yield* Effect.andThen(pageOpenFor(ada), pageOpenFor(ada));
  yield* answer(() => screen.findAllByText("Nothing read yet."));
  yield* Effect.andThen(Effect.andThen(settled, TestClock.adjust("3 days")), settled);
  yield* answer(() => screen.findAllByText(NUDGE));
});

function earlierInEveryPage(): readonly string[] {
  return textsOf(screen.getAllByRole("list", { name: "Earlier nudges" }));
}

function clickMarkReadInFirstPage(): void {
  const [firstPane = null] = screen.getAllByRole("main");
  if (firstPane !== null) {
    fireEvent.click(within(firstPane).getByRole("button", { name: "Mark read" }));
  }
}

it.effect("a nudge marked read in one page leaves For you in the person's other page too, with no reload", () =>
  Effect.gen(function* markedReadElsewhere() {
    yield* twoPagesNudged;
    clickMarkReadInFirstPage();
    const caughtUp = yield* answer(() =>
      waitFor(() => {
        expect(screen.queryAllByText("You're all caught up.")).toHaveLength(TWO);

        return TWO;
      }),
    );

    expect([caughtUp, screen.queryAllByRole("list", { name: "For you" }), earlierInEveryPage()]).toStrictEqual([
      TWO,
      [],
      [expect.stringContaining(NUDGE), expect.stringContaining(NUDGE)],
    ]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);
