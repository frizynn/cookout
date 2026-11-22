import { expect, it } from "vitest";
import { packageName } from "../src/index.ts";

it("is importable through its entry point", () => {
  expect(packageName).toBe("@ai-hero/cookout-storage-sqlite");
});
