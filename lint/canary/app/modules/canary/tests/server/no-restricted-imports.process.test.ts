import { expect, it } from "@effect/vitest";
import { ChildProcess } from "effect/process";

it("spawns a process from a test", () => {
  expect(ChildProcess.make).toBeDefined();
});
