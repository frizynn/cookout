import { Array as Arr, Effect, Fiber, Schedule, String as Str } from "effect";
import type { BinNeeds, BinResult, CookoutUnderTestService, Link } from "../../server.ts";
import {
  CookoutUnderTest,
  calledThreadId,
  cookoutUnderTest,
  exampleCommand,
  freshStateFolder,
  link,
  requireExampleCommand,
} from "../../server.ts";
import type { FileSystem, Scope } from "effect";
import type { MessageId, Reply } from "@ai-hero/cookout/sdk";
import { expect, it } from "@effect/vitest";
import { NodeServices } from "@effect/platform-node";

type Needs = BinNeeds | FileSystem.FileSystem;

interface Session {
  readonly name: string;
  readonly cookout: (...args: readonly string[]) => Effect.Effect<BinResult, never, Needs>;
}

interface Watching {
  readonly cookout: CookoutUnderTestService;
  readonly channel: string;
  readonly caller: Session;
  readonly relay: Link;
  readonly stopWatching: Effect.Effect<BinResult>;
}

const succeeded = { exitCode: 0, stderr: "" };
const EXIT_TOKEN = 3;
const LAST = 1;
const CONNECTED = "event: connected";
const ITEM = "event: inbox-item";
const ACCEPTED = 202;
const POLL = Schedule.spaced("500 millis");
const RETRIED_WITHIN = 60_000;
const callPath = `/v1/commands/${exampleCommand}/calls`;
const done = `/${exampleCommand} is done.`;

const cookoutWithHandler: Effect.Effect<CookoutUnderTestService, never, CookoutUnderTest> = Effect.gen(
  function* checkTheHandler() {
    yield* requireExampleCommand;
    return yield* CookoutUnderTest;
  },
);

function joinedAgent(
  cookout: CookoutUnderTestService,
  name: string,
  url = cookout.url,
): Effect.Effect<Session, never, Needs> {
  return Effect.gen(function* joinAsAgent() {
    const { identity, token } = yield* cookout.createAgent(name);
    const stateFolder = yield* freshStateFolder;
    function run(...args: readonly string[]): Effect.Effect<BinResult, never, Needs> {
      return cookout.runCookout({ args, stateFolder, token, url });
    }
    const joined = yield* run("join", "--as", identity.name);

    expect(joined).toMatchObject(succeeded);

    return { cookout: run, name: identity.name };
  });
}

function callerWatching(cookout: CookoutUnderTestService): Effect.Effect<Watching, never, Needs | Scope.Scope> {
  return Effect.gen(function* startWatching() {
    const { channel } = yield* cookout.createChannel("calls");
    const relay = yield* link(cookout.url);
    const caller = yield* joinedAgent(cookout, "caller", relay.url);
    const watch = yield* Effect.forkScoped(caller.cookout("watch"));
    yield* relay.relayed(CONNECTED);
    const stopWatching = Effect.promise(() => cookout.admin.deleteIdentity(caller.name)).pipe(
      Effect.andThen(relay.cut),
      Effect.andThen(Fiber.join(watch)),
    );
    return { caller, channel: channel.name, cookout, relay, stopWatching };
  });
}

function callExample(session: Session, channel: string, data: string): Effect.Effect<MessageId, never, Needs> {
  return Effect.gen(function* callFromTheCli() {
    const called = yield* session.cookout("command", "call", exampleCommand, "--channel", channel, "--data", data);

    expect(called).toMatchObject(succeeded);

    return yield* calledThreadId(called);
  });
}

function calledWhileWatching(watching: Watching): Effect.Effect<MessageId, never, Needs> {
  return Effect.gen(function* callAndCheckTheAnswer() {
    const { caller, channel, cookout, relay } = watching;
    const thread = yield* callExample(caller, channel, '{"branch":"main"}');
    const answered = yield* relay.answered;
    const { parent } = yield* Effect.promise(() => cookout.admin.getThread(thread));

    expect(answered).toContainEqual({ method: "POST", path: callPath, status: ACCEPTED });
    expect(parent).toMatchObject({
      author: { name: caller.name },
      data: { command: exampleCommand, data: { branch: "main" } },
      text: `/${exampleCommand}`,
    });

    return thread;
  });
}

function repliesOnceThere(cookout: CookoutUnderTestService, thread: MessageId): Effect.Effect<readonly Reply[]> {
  return Effect.promise(() => cookout.admin.getThread(thread)).pipe(
    Effect.repeat({ schedule: POLL, until: ({ replies }) => Arr.isReadonlyArrayNonEmpty(replies) }),
    Effect.map(({ replies }) => replies),
  );
}

function itemLines({ stdout }: BinResult): readonly string[] {
  return Arr.dropRight(Str.split(Str.trimEnd(stdout), "\n"), LAST);
}

function lineFor(channel: string, thread: MessageId): (reply: Reply) => string {
  return ({ author, id, text }) => `#${channel} thread:${String(thread)} @${author.name}: ${text} (msg ${String(id)})`;
}

function callAndWatch(): Effect.Effect<void, never, Scope.Scope> {
  return Effect.gen(function* watchTheResult() {
    const cookout = yield* cookoutWithHandler;
    const watching = yield* callerWatching(cookout);
    const thread = yield* calledWhileWatching(watching);
    yield* watching.relay.relayed(ITEM);
    const replies = yield* repliesOnceThere(cookout, thread);
    const watched = yield* watching.stopWatching;

    expect(replies).toMatchObject([
      { author: { name: exampleCommand }, data: { received: { branch: "main" } }, text: done },
    ]);
    expect(watched.exitCode).toBe(EXIT_TOKEN);
    expect(itemLines(watched)).toStrictEqual(Arr.map(replies, lineFor(watching.channel, thread)));
  }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer]));
}

function callFailFirst(): Effect.Effect<void, never, Scope.Scope> {
  return Effect.gen(function* waitForTheRetry() {
    const cookout = yield* cookoutWithHandler;
    const { channel } = yield* cookout.createChannel("retried");
    const caller = yield* joinedAgent(cookout, "caller");
    const thread = yield* callExample(caller, channel.name, '{"branch":"main","failFirst":true}');
    const replies = yield* repliesOnceThere(cookout, thread);

    expect(replies).toMatchObject([
      { author: { name: exampleCommand }, data: { received: { branch: "main", failFirst: true } }, text: done },
    ]);
  }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer]));
}

it.live(
  "a CLI call to the example command answers 202 at once with the call message, and the handler's result reply arrives over cookout watch",
  callAndWatch,
);

it.live(
  "a call the example handler fails first is retried with the same call, and its result reply arrives",
  callFailFirst,
  RETRIED_WITHIN,
);
