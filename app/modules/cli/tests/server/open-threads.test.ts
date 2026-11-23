import type { CliResult, CommandLineNeeds, TestIdentity } from "../../../testing/server.ts";
import { Effect, pipe } from "effect";
import {
  TestCookout,
  answer,
  commandLineServices,
  freshStateFolder,
  runCookout,
  testCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { MessageId } from "../../../messages/index.ts";

const ONE_AT_A_TIME = { concurrency: 1 } as const;
const PAGE_OF_ONE = 1;

interface Board {
  readonly ann: TestIdentity;
  readonly env: Readonly<Record<string, string>>;
  readonly mine: MessageId;
}

const annAndBobPost = Effect.gen(function* annAndBob() {
  const cookout = yield* TestCookout;
  const ann = yield* cookout.createIdentity("ann");
  const bob = yield* cookout.createIdentity("bob");
  const folder = yield* freshStateFolder;
  yield* answer(() => ann.client.createChannel({ name: "grill" }));
  const { message } = yield* answer(() => ann.client.createMessage({ channel: "grill", text: "mine" }));
  yield* answer(() => bob.client.createMessage({ channel: "grill", text: "bob's" }));
  const board: Board = {
    ann,
    env: { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: ann.token, COOKOUT_URL: cookout.url },
    mine: message.id,
  };
  return board;
});

function runAll(
  env: Readonly<Record<string, string>>,
  commandLines: readonly (readonly string[])[],
): Effect.Effect<readonly CliResult[], never, CommandLineNeeds> {
  return pipe(
    commandLines,
    Effect.forEach((args) => runCookout({ args, env }), ONE_AT_A_TIME),
  );
}

it.effect("cookout thread list prints the open threads involving the caller, and --all every open thread", () =>
  Effect.gen(function* listOpen() {
    const { ann, env, mine } = yield* annAndBobPost;
    const results = yield* runAll(env, [
      ["thread", "list"],
      ["thread", "list", "--all"],
    ]);
    const all = yield* answer(() => ann.client.listOpenThreads({ all: true }));

    expect(results).toMatchObject([
      { exitCode: 0, stdoutJson: { cursor: null, hasMore: false, threads: [{ message: { id: mine } }] } },
      { exitCode: 0, stdoutJson: all },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout thread list pages with --limit and --cursor", () =>
  Effect.gen(function* listPaged() {
    const { ann, env } = yield* annAndBobPost;
    const first = yield* answer(() => ann.client.listOpenThreads({ all: true, limit: PAGE_OF_ONE }));
    const rest = yield* answer(() => ann.client.listOpenThreads({ all: true, cursor: String(first.cursor) }));
    const results = yield* runAll(env, [
      ["thread", "list", "--all", "--limit", String(PAGE_OF_ONE)],
      ["thread", "list", "--all", "--cursor", String(first.cursor)],
    ]);

    expect(results).toMatchObject([
      { exitCode: 0, stdoutJson: first },
      { exitCode: 0, stdoutJson: rest },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
