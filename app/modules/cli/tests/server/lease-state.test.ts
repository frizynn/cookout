import { Array as Arr, Effect } from "effect";
import {
  TestCookout,
  commandLineServices,
  damageLeaseStates,
  freshStateFolder,
  leaseStateFiles,
  runCookout,
  testCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const EXIT_FAILURE = 1;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ONE_FILE = 1;
const JOIN = ["join", "--as", "agent"];

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

it.effect("a damaged lease-state file fails the command and says to delete it", () =>
  Effect.gen(function* damagedState() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const folder = yield* freshStateFolder;
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: agent.token, COOKOUT_URL: cookout.url };
    yield* runCookout({ args: JOIN, env });
    yield* damageLeaseStates(folder);
    const result = yield* runCookout({ args: ["channel", "list"], env });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "cli_error" } } });
    expect(result.stderr).toContain("is damaged. Delete it and join again.");
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
