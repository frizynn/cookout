import { Array as Arr, Cause, Effect, Exit } from "effect";
import { e2eNameStart, requireRunIdentity, runPrefix, runPrefixSpace } from "../../server.ts";
import { expect, it } from "@effect/vitest";

const FIRST_DRAW = 0;
const LAST_DRAW = 2_821_109_907_455;
const DRAWS = 2_821_109_907_456;

it("every run's prefix is e2e- then eight base-36 characters, which the deploy check filters on", {
  timeout: 1000,
}, () => {
  expect.hasAssertions();

  expect([e2eNameStart, runPrefixSpace]).toStrictEqual(["e2e-", DRAWS]);
  expect(runPrefix(FIRST_DRAW)).toBe("e2e-00000000");
  expect(runPrefix(LAST_DRAW)).toBe("e2e-zzzzzzzz");
});

function outcome(exit: Exit.Exit<string>): unknown {
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  return Cause.squash(exit.cause);
}

it.effect(
  "a run may act only on identities named with its own prefix, never the example handler or another run's",
  () =>
    Effect.gen(function* actOnlyOnOwn() {
      const prefix = runPrefix(FIRST_DRAW);
      const names = [`${prefix}-caller`, "example", `${runPrefix(LAST_DRAW)}-caller`, prefix];
      const guard = requireRunIdentity(prefix);
      const exits = yield* Effect.forEach(names, (name) => Effect.exit(guard(name)), { concurrency: 1 });

      expect(Arr.map(exits, (exit) => outcome(exit))).toStrictEqual([
        `${prefix}-caller`,
        new Error(
          "example isn't an identity this e2e run created (e2e-00000000-…): a test may deactivate, delete or rotate only its own.",
        ),
        new Error(
          "e2e-zzzzzzzz-caller isn't an identity this e2e run created (e2e-00000000-…): a test may deactivate, delete or rotate only its own.",
        ),
        new Error(
          "e2e-00000000 isn't an identity this e2e run created (e2e-00000000-…): a test may deactivate, delete or rotate only its own.",
        ),
      ]);
    }),
);
