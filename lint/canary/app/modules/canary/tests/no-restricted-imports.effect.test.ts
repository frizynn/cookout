import { expect, it } from "vitest";
import { Effect } from "effect";

it("imports Effect outside tests/server/", () => {
  expect(Effect.void).toBeDefined();
});
