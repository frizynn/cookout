import type { CliResult, CommandLineNeeds, TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { Effect, pipe } from "effect";
import {
  TestCookout,
  answer,
  commandLineServices,
  freshStateFolder,
  runCookout,
  testCookout,
  watchCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Message } from "../../../messages/index.ts";
import type { Scope } from "effect";

const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ONE_LINE = 1;
const USAGE = 1;

interface Board {
  readonly cookout: TestCookoutService;
  readonly ann: TestIdentity;
  readonly bob: TestIdentity;
  readonly message: Message;
  readonly folder: string;
}

const annPosts: Effect.Effect<Board, never, TestCookout | CommandLineNeeds | Scope.Scope> = Effect.gen(
  function* annAndBob() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const bob = yield* cookout.createIdentity("bob");
    const folder = yield* freshStateFolder;
    yield* answer(() => ann.client.createChannel({ name: "grill" }));
    const { message } = yield* answer(() => ann.client.createMessage({ channel: "grill", text: "ship  it?" }));
    return { ann, bob, cookout, folder, message };
  },
);

function envFor({ cookout, folder }: Board, who: TestIdentity): Readonly<Record<string, string>> {
  return { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: who.token, COOKOUT_URL: cookout.url };
}

function runAll(
  env: Readonly<Record<string, string>>,
  commandLines: readonly (readonly string[])[],
): Effect.Effect<readonly CliResult[], never, CommandLineNeeds> {
  return pipe(
    commandLines,
    Effect.forEach((args) => runCookout({ args, env }), ONE_AT_A_TIME),
  );
}

it.effect("cookout react and unreact take up or down and print the message's reactions, which thread get shows", () =>
  Effect.gen(function* reactAndUnreact() {
    const board = yield* annPosts;
    const id = String(board.message.id);
    const results = yield* runAll(envFor(board, board.bob), [
      ["react", id, "up"],
      ["react", id, "down"],
      ["unreact", id, "up"],
      ["thread", "get", id],
      ["react", id, "heart"],
    ]);

    const down = [{ by: ["bob"], count: 1, reaction: "thumbs_down" }];

    expect(results).toMatchObject([
      { exitCode: 0, stdoutJson: { reactions: [{ by: ["bob"], count: 1, reaction: "thumbs_up" }] } },
      { exitCode: 0, stdoutJson: { reactions: [{ reaction: "thumbs_up" }, { reaction: "thumbs_down" }] } },
      { exitCode: 0, stdoutJson: { channel: "grill", messageId: board.message.id, reactions: down } },
      { exitCode: 0, stdoutJson: { parent: { reactions: down } } },
      { exitCode: USAGE },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout inbox lists the author's reaction item, and cookout ack clears it", () =>
  Effect.gen(function* inboxItem() {
    const board = yield* annPosts;
    const id = String(board.message.id);
    yield* answer(() => board.bob.client.react(board.message.id, "thumbs_up"));
    const results = yield* runAll(envFor(board, board.ann), [["inbox"], ["ack", id], ["inbox"]]);

    expect(results).toMatchObject([
      {
        exitCode: 0,
        stdoutJson: { items: [{ newReactions: [{ identity: "bob", reaction: "thumbs_up" }], reasons: ["reaction"] }] },
      },
      { exitCode: 0 },
      { exitCode: 0, stdoutJson: { items: [] } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout watch prints a line saying who reacted with what to the watcher's message", () =>
  Effect.gen(function* watchReaction() {
    const board = yield* annPosts;
    const { message } = board;
    const watched = yield* watchCookout({
      args: ["watch"],
      env: envFor(board, board.ann),
      lines: ONE_LINE,
      whileWatching: answer(() => board.bob.client.react(message.id, "thumbs_up")),
    });

    const id = String(message.id);

    expect(watched.stdoutLines).toStrictEqual([
      `#grill thread:${id} @bob reacted with 👍 to your message: ship it? (msg ${id})`,
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
