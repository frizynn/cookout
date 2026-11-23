import { TestCookout, commandLineServices, runCookout, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

const ONE_AT_A_TIME = { concurrency: 1 } as const;
const succeeded = { exitCode: 0, stderr: "" };
const verbs: readonly (readonly string[])[] = [
  ["identity", "admin", "grace"],
  ["identity", "admin", "grace", "--remove"],
];

it.effect("cookout identity admin makes an admin, and --remove takes it away", () =>
  Effect.gen(function* adminVerbs() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("grace", { kind: "human" });
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const results = yield* Effect.forEach(verbs, (args) => runCookout({ args, env }), ONE_AT_A_TIME);

    expect(results).toMatchObject([
      { ...succeeded, stdoutJson: { identity: { admin: true, name: "grace" } } },
      { ...succeeded, stdoutJson: { identity: { admin: false, name: "grace" } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
