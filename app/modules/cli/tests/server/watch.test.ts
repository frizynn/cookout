import type { CommandLineNeeds, Watched } from "../../../testing/server.ts";
import { Effect, String as Str } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import {
  TestCookout,
  answer,
  commandLineServices,
  freshStateFolder,
  testCookout,
  watchCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";

interface Posted {
  readonly parent: MessageId;
  readonly reply: Message;
}

const ONE_LINE = 1;
const SHOWN = 120;
const LONG = 150;
const LONG_TEXT = `@bob look\n\nat  ${Str.repeat(LONG)("x")}`;

function watchOneReply(args: readonly string[]): Effect.Effect<Watched<Posted>, never, CommandLineNeeds | Scope.Scope> {
  return Effect.gen(function* watchAsBob() {
    const cookout = yield* TestCookout;
    const ann = yield* cookout.createIdentity("ann");
    const bob = yield* cookout.createIdentity("bob");
    const folder = yield* freshStateFolder;
    yield* answer(() => ann.client.createChannel({ name: "grill" }));
    const { message: parent } = yield* answer(() => ann.client.createMessage({ channel: "grill", text: "parent" }));
    const ack = answer(() => bob.client.ack(parent.id));
    const reply = answer(() => ann.client.createMessage({ channel: "grill", replyTo: parent.id, text: LONG_TEXT }));
    return yield* watchCookout({
      args,
      env: { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: bob.token, COOKOUT_URL: cookout.url },
      lines: ONE_LINE,
      whileWatching: Effect.map(Effect.andThen(ack, reply), ({ message }) => ({ parent: parent.id, reply: message })),
    });
  }).pipe(Effect.provide(testCookout()));
}

it.effect(
  "cookout watch prints no line for an ack, and names a reply's thread with its text on one line, cut at 120 characters",
  () =>
    Effect.gen(function* watchText() {
      const {
        during: { parent, reply },
        stdoutLines,
      } = yield* watchOneReply(["watch"]);
      const shown = Str.takeLeft(`@bob look at ${Str.repeat(LONG)("x")}`, SHOWN);

      expect(stdoutLines).toStrictEqual([`#grill thread:${String(parent)} @ann: ${shown} (msg ${String(reply.id)})`]);
    }).pipe(Effect.provide(commandLineServices)),
);

it.effect("cookout watch --json prints the whole event, text untouched", () =>
  Effect.gen(function* watchJson() {
    const {
      during: { reply },
      stdoutJson,
    } = yield* watchOneReply(["watch", "--json"]);

    expect(stdoutJson).toMatchObject([
      { item: { message: reply, reasons: ["followed-thread", "mention"] }, type: "inbox-item" },
    ]);
  }).pipe(Effect.provide(commandLineServices)),
);
