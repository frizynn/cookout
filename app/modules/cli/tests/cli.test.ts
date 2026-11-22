import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { runCookout } from "../../testing/server.ts";

it.effect("the CLI refuses an unknown command with a usage error", () =>
  Effect.gen(function* () {
    const result = yield* runCookout(["identity", "explode"], { COOKOUT_URL: "http://127.0.0.1:1" });
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: "usage" } });
  }),
);
