import { Array as Arr, Effect, Schema, pipe } from "effect";
import type { CommandLineNeeds, TestCookoutService } from "../../../testing/server.ts";
import { TestCookout, answer, commandLineServices, messageId, runDev, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const NO_OWNER = "(no owner)";
const SeededIdentity = Schema.Struct({ identity: Schema.Struct({ name: Schema.String }), token: Schema.String });
const SeedOutput = Schema.Struct({
  identities: Schema.Array(SeededIdentity),
  thread: Schema.Int,
});
const onIt = "I am. It fails about one run in ten on CI.";
const question = "@triage-agent can you post the failing run?";
const thanks = "Thanks, both of you.";
const deployed = "Deployed 1.4.2.";
const isSeedOutput = Schema.is(SeedOutput);

function seeded(cookout: TestCookoutService): Effect.Effect<typeof SeedOutput.Type, never, CommandLineNeeds> {
  return Effect.gen(function* seedTheCookout() {
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const { stdoutJson } = yield* runDev({ args: ["seed"], env });
    if (isSeedOutput(stdoutJson)) {
      return stdoutJson;
    }
    return expect.unreachable("pnpm seed printed no board");
  });
}

it.effect("the seed makes identities with and without owners, each with a working token", () =>
  Effect.gen(function* seededIdentities() {
    const cookout = yield* TestCookout;
    const board = yield* seeded(cookout);
    const { identities } = yield* answer(() => cookout.client.listIdentities());
    const whoami = yield* pipe(
      board.identities,
      Effect.forEach(({ token }) => answer(() => cookout.clientFor(token).whoami()), { concurrency: 1 }),
    );

    expect(Arr.map(identities, ({ name, owner = NO_OWNER }) => [name, owner])).toStrictEqual([
      ["ada", NO_OWNER],
      ["admin", NO_OWNER],
      ["grace", NO_OWNER],
      ["release-bot", "ada"],
      ["triage-agent", "grace"],
    ]);
    expect(Arr.map(whoami, ({ identity }) => identity.name)).toStrictEqual([
      "ada",
      "grace",
      "release-bot",
      "triage-agent",
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("the seed makes channels with top-level messages and a thread holding a reply to a reply", () =>
  Effect.gen(function* seededThread() {
    const cookout = yield* TestCookout;
    const board = yield* seeded(cookout);
    const { channels } = yield* answer(() => cookout.client.listChannels());
    const general = yield* answer(() => cookout.client.listMessages("general"));
    const thread = yield* answer(() => cookout.client.getThread(messageId(board.thread)));

    expect(Arr.map(channels, ({ name }) => name)).toStrictEqual(["deploys", "general"]);
    expect(Arr.map(general.messages, ({ text }) => text)).toStrictEqual([
      "Morning! Who is looking at the flaky login test?",
      "Lunch at 12:30.",
    ]);
    expect(thread.parent.text).toBe("Morning! Who is looking at the flaky login test?");
    expect(Arr.map(thread.replies, ({ author, replyTo, text }) => [author.name, replyTo, text])).toStrictEqual([
      ["triage-agent", board.thread, "I am. It fails about one run in ten on CI."],
      ["grace", board.thread, "@triage-agent can you post the failing run?"],
      ["ada", board.thread, "Thanks, both of you."],
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("the seed leaves a mention, a followed thread and a subscribed channel in the inboxes", () =>
  Effect.gen(function* seededInboxes() {
    const cookout = yield* TestCookout;
    const board = yield* seeded(cookout);
    const inboxes = yield* pipe(
      board.identities,
      Effect.forEach(
        ({ identity, token }) =>
          Effect.map(
            answer(() => cookout.clientFor(token).inbox()),
            ({ items }) => [identity.name, Arr.map(items, ({ message, reasons }) => [message.text, reasons])] as const,
          ),
        { concurrency: 1 },
      ),
    );

    expect(inboxes).toStrictEqual([
      ["ada", []],
      [
        "grace",
        [
          [thanks, ["followed-thread"]],
          [deployed, ["subscribed-channel"]],
        ],
      ],
      [
        "release-bot",
        [
          [onIt, ["followed-thread"]],
          [question, ["followed-thread"]],
          [thanks, ["followed-thread"]],
        ],
      ],
      [
        "triage-agent",
        [
          [question, ["followed-thread", "mention"]],
          [thanks, ["followed-thread"]],
        ],
      ],
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
