import { Array as Arr, Effect, pipe } from "effect";
import type { CliResult, CommandLineNeeds } from "../../../testing/server.ts";
import {
  TestCookout,
  commandLineServices,
  freshStateFolder,
  runCookout,
  testCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

interface Step {
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

const EXIT_FAILURE = 1;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const JOIN = ["join", "--as", "agent"];
const LEASE_END = "2026-01-01T00:01:00.000Z";
const succeeded = { exitCode: 0, stderr: "" };
const lease = { expiresAt: LEASE_END, leaseId: "lease_test_3" };
const held = {
  exitCode: EXIT_FAILURE,
  stderrJson: { error: { code: "lease_held", details: { heldUntil: LEASE_END } } },
};

function failedWith(code: string): object {
  return { exitCode: EXIT_FAILURE, stderrJson: { error: { code } } };
}

function runAll(steps: readonly Step[]): Effect.Effect<readonly CliResult[], never, CommandLineNeeds> {
  return pipe(steps, Effect.forEach(runCookout, ONE_AT_A_TIME));
}

it.effect(
  "two CLI sessions with the same token: the second join is refused with heldUntil, join --force takes over",
  () =>
    Effect.gen(function* twoCliSessions() {
      const cookout = yield* TestCookout;
      const agent = yield* cookout.createIdentity("agent");
      const [firstFolder, secondFolder] = yield* Effect.all([freshStateFolder, freshStateFolder], ONE_AT_A_TIME);
      const session = { COOKOUT_TOKEN: agent.token, COOKOUT_URL: cookout.url };
      const first = { ...session, COOKOUT_STATE_DIR: firstFolder };
      const second = { ...session, COOKOUT_STATE_DIR: secondFolder };
      const results = yield* runAll([
        { args: JOIN, env: first },
        { args: JOIN, env: first },
        { args: JOIN, env: second },
        { args: [...JOIN, "--force"], env: second },
        { args: ["channel", "list"], env: first },
        { args: ["leave"], env: first },
        { args: ["leave"], env: first },
        { args: ["leave"], env: second },
        { args: JOIN, env: first },
      ]);

      expect(results).toMatchObject([
        { ...succeeded, stdoutJson: lease },
        { ...succeeded, stdoutJson: lease },
        held,
        succeeded,
        succeeded,
        failedWith("lease_lost"),
        failedWith("lease_required"),
        succeeded,
        succeeded,
      ]);
      expect(
        Arr.join(
          Arr.map(results, (result) => result.stderr),
          "\n",
        ),
      ).toContain("The stored lease was deleted; run `cookout join --as agent` to take it again.");
    }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout join without --as is a usage error", () =>
  Effect.gen(function* joinWithoutAs() {
    const result = yield* runCookout({
      args: ["join"],
      env: { COOKOUT_TOKEN: "cookout_x", COOKOUT_URL: "http://127.0.0.1:1" },
    });

    expect(result).toMatchObject(failedWith("usage"));
  }).pipe(Effect.provide(commandLineServices)),
);
