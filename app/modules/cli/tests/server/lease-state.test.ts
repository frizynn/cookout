import { Array as Arr, Effect, String as Str, pipe } from "effect";
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

const EXIT_FAILURE = 1;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ONE_FILE = 1;
const JOIN = ["join", "--as", "agent"];
const DAMAGED = "is damaged. Delete it and join again.";
const damaged = { exitCode: EXIT_FAILURE, stderrJson: { error: { code: "cli_error" } } };
const brokenStates = [
  "{",
  '{"expiresAt":"tomorrow","identity":"agent","leaseId":"lease_test_3","url":"http://x"}',
  '{"expiresAt":"2026-01-01T00:01:00.000Z","identity":"Not A Name","leaseId":"lease_test_3","url":"http://x"}',
];

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
