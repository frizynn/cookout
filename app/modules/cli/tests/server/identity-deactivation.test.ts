import { TestCookout, commandLineServices, runCookout, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

const ONE_AT_A_TIME = { concurrency: 1 } as const;
const succeeded = { exitCode: 0, stderr: "" };
const verbs: readonly (readonly string[])[] = [
  ["identity", "deactivate", "grace"],
  ["identity", "list"],
  ["identity", "list", "--deactivated"],
  ["identity", "reactivate", "grace"],
];

it.effect("cookout identity deactivate and reactivate, and identity list --deactivated shows the deactivated", () =>
  Effect.gen(function* deactivationVerbs() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("grace", { kind: "human" });
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const results = yield* Effect.forEach(verbs, (args) => runCookout({ args, env }), ONE_AT_A_TIME);

    expect(results).toMatchObject([
      { ...succeeded, stdoutJson: { agents: [], identity: { deactivated: true, name: "grace" } } },
      { ...succeeded, stdoutJson: { identities: [{ name: "admin" }] } },
      { ...succeeded, stdoutJson: { identities: [{ name: "admin" }, { deactivated: true, name: "grace" }] } },
      { ...succeeded, stdoutJson: { identity: { name: "grace" } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout identity delete deletes an identity, and a second delete prints identity_not_found", () =>
  Effect.gen(function* deleteVerb() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("e2e-cli-bot");
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const deleteArgs: readonly string[] = ["identity", "delete", "e2e-cli-bot"];
    const results = yield* Effect.forEach([deleteArgs, deleteArgs], (args) => runCookout({ args, env }), ONE_AT_A_TIME);

    expect(results).toMatchObject([
      { ...succeeded, stdoutJson: { identity: { name: "e2e-cli-bot" } } },
      { exitCode: 1, stderrJson: { error: { code: "identity_not_found" } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
