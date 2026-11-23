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
const WHOAMI = ["whoami"];
const succeeded = { exitCode: 0, stderr: "" };
const issued = {
  expiresAt: "2026-01-08T00:00:00.000Z",
  issuedAt: "2026-01-01T00:00:00.000Z",
};
const asAgent = { ...succeeded, stdoutJson: { identity: { name: "agent" } } };

function failedWith(code: string): object {
  return { exitCode: EXIT_FAILURE, stderrJson: { error: { code } } };
}

function runAll(steps: readonly Step[]): Effect.Effect<readonly CliResult[], never, CommandLineNeeds> {
  return pipe(steps, Effect.forEach(runCookout, ONE_AT_A_TIME));
}

it.effect("a CLI session keeps its agent session token in its state folder, and forgets it once revoked or left", () =>
  Effect.gen(function* twoCliSessions() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const [firstFolder, secondFolder] = yield* Effect.all([freshStateFolder, freshStateFolder], ONE_AT_A_TIME);
    const session = { COOKOUT_TOKEN: agent.token, COOKOUT_URL: cookout.url };
    const first = { ...session, COOKOUT_STATE_DIR: firstFolder };
    const second = { ...session, COOKOUT_STATE_DIR: secondFolder };
    const results = yield* runAll([
      { args: JOIN, env: first },
      { args: WHOAMI, env: first },
      { args: JOIN, env: second },
      { args: [...JOIN, "--force"], env: second },
      { args: WHOAMI, env: first },
      { args: WHOAMI, env: first },
      { args: ["leave"], env: second },
      { args: ["leave"], env: second },
      { args: [...JOIN, "--idle-expiry", "30d"], env: first },
    ]);

    expect(results).toMatchObject([
      { ...succeeded, stdoutJson: issued },
      asAgent,
      failedWith("agent_session_live"),
      succeeded,
      failedWith("agent_session_revoked"),
      asAgent,
      { ...succeeded, stdoutJson: { revoked: true } },
      failedWith("agent_session_required"),
      { ...succeeded, stdoutJson: { expiresAt: "2026-01-31T00:00:00.000Z" } },
    ]);
    expect(
      Arr.join(
        Arr.map(results, (result) => result.stderr),
        "\n",
      ),
    ).toContain("The stored agent session token was deleted; run `cookout join --as agent` to join again.");
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout join without --as, or with a name that breaks the naming rule, is a usage error", () =>
  Effect.gen(function* joinWithoutAs() {
    const env = { COOKOUT_TOKEN: "cookout_x", COOKOUT_URL: "http://127.0.0.1:1" };
    const withoutAs = yield* runCookout({ args: ["join"], env });
    const badName = yield* runCookout({ args: ["join", "--as", "Not A Name"], env });

    expect([withoutAs, badName]).toMatchObject([failedWith("usage"), failedWith("usage")]);
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("cookout join as a human identity, with or without --force, is refused with identity_kind", () =>
  Effect.gen(function* humanJoin() {
    const cookout = yield* TestCookout;
    const human = yield* cookout.createIdentity("ada", { kind: "human" });
    const folder = yield* freshStateFolder;
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: human.token, COOKOUT_URL: cookout.url };
    const results = yield* runAll([
      { args: ["join", "--as", "ada"], env },
      { args: ["join", "--as", "ada", "--force"], env },
    ]);
    const refused = {
      exitCode: EXIT_FAILURE,
      stderrJson: { error: { code: "identity_kind", message: "ada is a human identity; only agent identities join." } },
    };

    expect(results).toMatchObject([refused, refused]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
