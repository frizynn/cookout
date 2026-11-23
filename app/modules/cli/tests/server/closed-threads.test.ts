import type { CliResult, CommandLineNeeds } from "../../../testing/server.ts";
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

const ONE_AT_A_TIME = { concurrency: 1 } as const;

function runAll(
  env: Readonly<Record<string, string>>,
  commandLines: readonly (readonly string[])[],
): Effect.Effect<readonly CliResult[], never, CommandLineNeeds> {
  return pipe(
    commandLines,
    Effect.forEach((args) => runCookout({ args, env }), ONE_AT_A_TIME),
  );
}

it.effect("cookout thread close and thread reopen print the thread's top-level message, closed and then open", () =>
  Effect.gen(function* closeAndReopen() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const folder = yield* freshStateFolder;
    const { message } = yield* Effect.andThen(
      answer(() => ann.client.createChannel({ name: "grill" })),
      answer(() => ann.client.createMessage({ channel: "grill", text: "deploy main?" })),
    );
    const reply = yield* answer(() =>
      ann.client.createMessage({ channel: "grill", replyTo: message.id, text: "done" }),
    );
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: ann.token, COOKOUT_URL: cookout.url };
    const results = yield* runAll(env, [
      ["thread", "close", String(reply.message.id)],
      ["thread", "reopen", String(message.id)],
    ]);

    expect(results).toMatchObject([
      { exitCode: 0, stdoutJson: { message: { closedBy: "ann", id: message.id, replyCount: 1 } } },
      { exitCode: 0, stdoutJson: { message: { id: message.id } } },
    ]);
    expect(results).not.toHaveProperty("1.stdoutJson.message.closedAt");
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
