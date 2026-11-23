import { Array as Arr, Effect, Fiber, String as Str } from "effect";
import type { BinNeeds, BinResult, CookoutUnderTestService, Link } from "../../server.ts";
import { CookoutUnderTest, cookoutUnderTest, freshStateFolder, link, postedMessageId } from "../../server.ts";
import type { FileSystem, Scope } from "effect";
import { expect, it } from "@effect/vitest";
import type { MessageId } from "@ai-hero/cookout/sdk";
import { NodeServices } from "@effect/platform-node";

type Needs = BinNeeds | FileSystem.FileSystem;

interface Session {
  readonly name: string;
  readonly cookout: (...args: readonly string[]) => Effect.Effect<BinResult, never, Needs>;
}

interface Exited {
  readonly exitCode: number;
  readonly items: readonly string[];
  readonly last: string;
}

interface Watching {
  readonly channel: string;
  readonly first: Session;
  readonly second: Session;
  readonly relay: Link;
  readonly deleteTheWatcher: Effect.Effect<Exited>;
}

interface AcrossADrop {
  readonly before: MessageId;
  readonly missed: MessageId;
  readonly after: MessageId;
}

interface ItemLine {
  readonly channel: string;
  readonly thread: MessageId;
  readonly author: string;
  readonly text: string;
  readonly message: MessageId;
}

const succeeded = { exitCode: 0, stderr: "" };
const EXIT_TOKEN = 3;
const LAST = 1;
const TWICE = 2;
const THRICE = 3;
const CONNECTED = "event: connected";
const ITEM = "event: inbox-item";
const FATAL = /^cookout watch stopped: .*\(token_[a-z]+\)$/u;

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

function post(session: Session, args: readonly string[]): Effect.Effect<MessageId, never, Needs> {
  return Effect.gen(function* postMessage() {
    const posted = yield* session.cookout("message", "post", ...args);

    expect(posted).toMatchObject(succeeded);

    return yield* postedMessageId(posted);
  });
}

function exitedWith({ exitCode, stdout }: BinResult): Exited {
  const lines = Str.split(Str.trimEnd(stdout), "\n");
  return { exitCode, items: Arr.dropRight(lines, LAST), last: Arr.lastNonEmpty(lines) };
}

const secondWatching: Effect.Effect<Watching, never, CookoutUnderTest | Needs | Scope.Scope> = Effect.gen(
  function* startWatching() {
    const cookout = yield* CookoutUnderTest;
    const { channel } = yield* cookout.createChannel("room");
    const first = yield* joinedAgent(cookout, "agent-1");
    const relay = yield* link(cookout.url);
    const second = yield* joinedAgent(cookout, "watcher", relay.url);
    const watch = yield* Effect.forkScoped(second.cookout("watch"));
    yield* relay.relayed(CONNECTED);
    const deleteTheWatcher = Effect.promise(() => cookout.admin.deleteIdentity(second.name)).pipe(
      Effect.andThen(relay.cut),
      Effect.andThen(Fiber.join(watch)),
      Effect.map(exitedWith),
    );
    return { channel: channel.name, deleteTheWatcher, first, relay, second };
  },
);

function postWhileDown({ channel, first, relay }: Watching, text: string): Effect.Effect<MessageId, never, Needs> {
  return Effect.gen(function* postWhileTheLinkIsDown() {
    yield* relay.takeDown;
    const missed = yield* post(first, [channel, text]);
    yield* relay.bringUp;
    yield* relay.relayed(CONNECTED, TWICE);
    return missed;
  });
}

function mentionOf(label: string, { second }: Pick<Watching, "second">): string {
  return `${label}, @${second.name}.`;
}

function mentionAcrossADrop(watching: Watching): Effect.Effect<AcrossADrop, never, Needs> {
  return Effect.gen(function* mentionBeforeDuringAndAfter() {
    const { channel, first, relay } = watching;
    const before = yield* post(first, [channel, mentionOf("Before the drop", watching)]);
    yield* relay.relayed(ITEM);
    const missed = yield* postWhileDown(watching, mentionOf("While down", watching));
    yield* relay.relayed(ITEM, TWICE);
    const after = yield* post(first, [channel, mentionOf("After", watching)]);
    yield* relay.relayed(ITEM, THRICE);
    return { after, before, missed };
  });
}

function lineFor({ author, channel, message, text, thread }: ItemLine): string {
  return `#${channel} thread:${String(thread)} @${author}: ${text} (msg ${String(message)})`;
}

it.live(
  "cookout watch prints one stdout line for each item another agent sends it, a mention and a reply in a thread it follows",
  () =>
    Effect.gen(function* watchTwoItems() {
      const { channel, deleteTheWatcher, first, relay, second } = yield* secondWatching;
      const question = `Are you there, @${second.name}?`;
      const top = yield* post(first, [channel, question]);
      const reply = yield* post(second, [channel, "Here.", "--reply-to", String(top)]);
      const thanks = yield* post(first, [channel, "Thanks.", "--reply-to", String(reply)]);
      yield* relay.relayed(ITEM, TWICE);
      const exited = yield* deleteTheWatcher;
      const from = { author: first.name, channel, thread: top };

      expect(exited).toMatchObject({
        exitCode: EXIT_TOKEN,
        items: [
          lineFor({ ...from, message: top, text: question }),
          lineFor({ ...from, message: thanks, text: "Thanks." }),
        ],
      });
      expect(exited.last).toMatch(FATAL);
    }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);

it.live(
  "after a forced reconnect cookout watch resumes from the last item it printed: it prints what it missed and repeats nothing",
  () =>
    Effect.gen(function* watchAcrossADrop() {
      const watching = yield* secondWatching;
      const { after, before, missed } = yield* mentionAcrossADrop(watching);
      const exited = yield* watching.deleteTheWatcher;
      const lastEventIds = yield* watching.relay.lastEventIds;
      const from = { author: watching.first.name, channel: watching.channel };

      expect(exited).toMatchObject({
        exitCode: EXIT_TOKEN,
        items: [
          lineFor({ ...from, message: before, text: mentionOf("Before the drop", watching), thread: before }),
          lineFor({ ...from, message: missed, text: mentionOf("While down", watching), thread: missed }),
          lineFor({ ...from, message: after, text: mentionOf("After", watching), thread: after }),
        ],
      });
      expect(exited.last).toMatch(FATAL);
      expect(lastEventIds).toStrictEqual([null, String(before), String(after)]);
    }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);

it.live("deleting the watcher's identity ends cookout watch with one fatal stdout line and exit 3", () =>
  Effect.gen(function* watchDeleted() {
    const { deleteTheWatcher } = yield* secondWatching;
    const exited = yield* deleteTheWatcher;

    expect(exited).toMatchObject({ exitCode: EXIT_TOKEN, items: [] });
    expect(exited.last).toMatch(FATAL);
  }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);
