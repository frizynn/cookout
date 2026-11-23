import { expect, it } from "@effect/vitest";

it("packs a test against another", () => {
  expect(true).toBe(true);
});
it("has no blank line above it", () => {
  expect(false).toBe(false);
});
