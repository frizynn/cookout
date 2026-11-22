import { describe, expect, it } from "@effect/vitest";

describe("a describe block", () => {
  it("nests a test", () => {
    expect(true).toBe(true);
  });
});
