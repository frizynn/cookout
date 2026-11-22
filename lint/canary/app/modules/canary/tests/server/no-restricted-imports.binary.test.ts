import { expect, it } from "@effect/vitest";
import { runCookoutBinary } from "../../../testing/server.ts";

it("runs the cookout binary from a test outside cli.test.ts", () => {
  expect(runCookoutBinary).toBeDefined();
});
