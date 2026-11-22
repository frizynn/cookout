import { beforeEach, expect, it } from "@effect/vitest";

const seen: Array<number> = [];

beforeEach(() => {
  seen.push(1);
});

it("runs after a hook", () => {
  expect(seen).toHaveLength(1);
});
