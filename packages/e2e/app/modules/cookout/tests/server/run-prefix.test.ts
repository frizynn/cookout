import { e2eNameStart, runPrefix, runPrefixSpace } from "../../server.ts";
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
