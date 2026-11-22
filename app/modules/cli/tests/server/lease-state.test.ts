import { Array as Arr, Effect, FileSystem, String as Str, pipe } from "effect";
import {
  TestCookout,
  commandLineServices,
  freshStateFolder,
  leaseStateFiles,
  runCookout,
  testCookout,
  writeLeaseStates,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { CommandLineNeeds } from "../../../testing/server.ts";

const EXIT_FAILURE = 1;
const EXIT_SUCCESS = 0;
const SHARED_FILE = 0o644;
const OWNER_ONLY = "600";
const OCTAL = 8;
const PERMISSION_DIGITS = -3;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ONE_FILE = 1;
const JOIN = ["join", "--as", "agent"];
const DAMAGED = "is damaged. Delete it and join again.";
const damaged = { exitCode: EXIT_FAILURE, stderrJson: { error: { code: "lease_state_damaged" } } };
const brokenStates = [
  "{",
  '{"expiresAt":"tomorrow","identity":"agent","leaseId":"lease_test_3","url":"http://x"}',
  '{"expiresAt":"2026-01-01T00:01:00.000Z","identity":"Not A Name","leaseId":"lease_test_3","url":"http://x"}',
];

function permissionsOf(file: string): Effect.Effect<string, never, FileSystem.FileSystem> {
  return Effect.gen(function* readPermissions() {
    const fs = yield* FileSystem.FileSystem;
    const { mode } = yield* Effect.orDie(fs.stat(file));
    return Str.slice(PERMISSION_DIGITS)(mode.toString(OCTAL));
  });
}

function plantSharedTemporary(folder: string): Effect.Effect<string, never, CommandLineNeeds> {
  return Effect.gen(function* plantTemporary() {
    const fs = yield* FileSystem.FileSystem;
    const [file = ""] = yield* leaseStateFiles(folder);
    yield* Effect.orDie(fs.writeFileString(`${file}.tmp`, "{}", { mode: SHARED_FILE }));
    return file;
  });
}

it.effect(
  "without COOKOUT_STATE_DIR, join keeps its lease under $XDG_STATE_HOME/cookout, else ~/.local/state/cookout",
  () =>
    Effect.gen(function* stateFolderDefaults() {
      const cookout = yield* TestCookout;
      const agent = yield* cookout.createIdentity("agent");
      const other = yield* cookout.createIdentity("other");
      const [xdg, home] = yield* Effect.all([freshStateFolder, freshStateFolder], ONE_AT_A_TIME);
      yield* runCookout({
        args: JOIN,
        env: { COOKOUT_TOKEN: agent.token, COOKOUT_URL: cookout.url, XDG_STATE_HOME: xdg },
      });
      yield* runCookout({
        args: ["join", "--as", "other"],
        env: { COOKOUT_TOKEN: other.token, COOKOUT_URL: cookout.url, HOME: home },
      });
      const found = yield* Effect.all(
        [leaseStateFiles(`${xdg}/cookout`), leaseStateFiles(`${home}/.local/state/cookout`)],
        ONE_AT_A_TIME,
      );

      expect(Arr.map(found, Arr.length)).toStrictEqual([ONE_FILE, ONE_FILE]);
    }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("join writes its lease-state file readable by its owner only, even over a stale temporary file", () =>
  Effect.gen(function* ownerOnlyState() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const folder = yield* freshStateFolder;
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: agent.token, COOKOUT_URL: cookout.url };
    yield* runCookout({ args: JOIN, env });
    const file = yield* plantSharedTemporary(folder);
    const again = yield* runCookout({ args: [...JOIN, "--force"], env });
    const mode = yield* permissionsOf(file);

    expect(again.exitCode).toBe(EXIT_SUCCESS);
    expect(mode).toBe(OWNER_ONLY);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("a lease-state file that isn't JSON, or breaks the expiry or identity rule, is damaged", () =>
  Effect.gen(function* damagedStates() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const folder = yield* freshStateFolder;
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: agent.token, COOKOUT_URL: cookout.url };
    yield* runCookout({ args: JOIN, env });
    const results = yield* pipe(
      brokenStates,
      Effect.forEach(
        (text) => Effect.andThen(writeLeaseStates({ folder, text }), runCookout({ args: ["channel", "list"], env })),
        ONE_AT_A_TIME,
      ),
    );

    expect(results).toMatchObject([damaged, damaged, damaged]);
    expect(Arr.every(results, ({ stderr }) => Str.includes(DAMAGED)(stderr))).toBe(true);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
