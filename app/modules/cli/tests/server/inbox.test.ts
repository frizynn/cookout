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

it.effect("cookout inbox prints the items as JSON, and cookout ack prints the new read position", () =>
  Effect.gen(function* inboxAndAck() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const bob = yield* cookout.createIdentity("bob");
    const folder = yield* freshStateFolder;
    yield* answer(() => ann.client.createChannel({ name: "grill" }));
    const { message } = yield* answer(() => ann.client.createMessage({ channel: "grill", text: "@bob have a look" }));
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: bob.token, COOKOUT_URL: cookout.url };
    const results = yield* runAll(env, [["inbox"], ["ack", String(message.id)]]);

    expect(results).toMatchObject([
      { exitCode: 0, stdoutJson: { items: [{ message: { id: message.id }, reasons: ["mention"] }] } },
      { exitCode: 0, stdoutJson: { readPosition: { messageId: message.id } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout follow, unfollow, subscribe and unsubscribe print the new state", () =>
  Effect.gen(function* followAndSubscribe() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const folder = yield* freshStateFolder;
    yield* answer(() => ann.client.createChannel({ name: "grill" }));
    const { message } = yield* answer(() => ann.client.createMessage({ channel: "grill", text: "parent" }));
    const env = { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: ann.token, COOKOUT_URL: cookout.url };
    const id = String(message.id);
    const results = yield* runAll(env, [
      ["unfollow", id],
      ["follow", id],
      ["subscribe", "grill"],
      ["unsubscribe", "grill"],
    ]);

    expect(results).toMatchObject([
      { exitCode: 0, stdoutJson: { following: false, thread: message.id } },
      { exitCode: 0, stdoutJson: { following: true, thread: message.id } },
      { exitCode: 0, stdoutJson: { channel: "grill", subscribed: true } },
      { exitCode: 0, stdoutJson: { channel: "grill", subscribed: false } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
