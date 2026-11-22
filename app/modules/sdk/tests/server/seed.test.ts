import { Array as Arr, Effect, pipe } from "effect";
import { TestCookout, answer, seedBoard, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const NO_OWNER = "(no owner)";

it.effect("the seed makes identities with and without owners, each with a working token", () =>
  Effect.gen(function* seededIdentities() {
    const cookout = yield* TestCookout;
    const board = yield* seedBoard({ token: cookout.adminToken, url: cookout.url });
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
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the seed makes channels with top-level messages and a thread holding a reply to a reply", () =>
  Effect.gen(function* seededThread() {
    const cookout = yield* TestCookout;
    const board = yield* seedBoard({ token: cookout.adminToken, url: cookout.url });
    const { channels } = yield* answer(() => cookout.client.listChannels());
    const general = yield* answer(() => cookout.client.listMessages("general"));
    const thread = yield* answer(() => cookout.client.getThread(board.thread));

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
  }).pipe(Effect.provide(testCookout())),
);
