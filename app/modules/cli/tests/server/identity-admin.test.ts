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

const ownerVerbs: readonly (readonly string[])[] = [
  ["identity", "sessions", "release-bot"],
  ["identity", "sessions", "release-bot", "--revoke"],
  ["identity", "transfer", "release-bot", "--owner", "grace"],
];

it.effect("cookout identity sessions lists, --revoke revokes, and transfer --owner gives the agent away", () =>
  Effect.gen(function* ownerVerbsRun() {
    const cookout = yield* TestCookout;
    yield* cookout.createIdentity("grace", { kind: "human" });
    yield* cookout.createIdentity("release-bot");
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const results = yield* Effect.forEach(ownerVerbs, (args) => runCookout({ args, env }), ONE_AT_A_TIME);

    expect(results).toMatchObject([
      { ...succeeded, stdoutJson: { agentSessions: [] } },
      { ...succeeded, stdoutJson: { revoked: false } },
      { ...succeeded, stdoutJson: { identity: { name: "release-bot", owner: "grace" } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
