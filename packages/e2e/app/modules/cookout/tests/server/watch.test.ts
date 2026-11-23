import type { BinResult, Relay, Session, SessionNeeds, WatchOutput } from "../../server.ts";
import {
  CookoutUnderTest,
  cookoutUnderTest,
  openRelay,
  watchExitTokenRevoked,
  watchLine,
  watchOutput,
} from "../../server.ts";
import { Effect, Fiber } from "effect";
import { expect, it } from "@effect/vitest";
import type { MessageId } from "@ai-hero/cookout/sdk";
import { NodeServices } from "@effect/platform-node";

interface Exited extends WatchOutput {
  readonly exitCode: number;
}

interface Watching {
  readonly channel: string;
  readonly first: Session;
  readonly second: Session;
  readonly relay: Relay;
  readonly deactivateTheWatcher: Effect.Effect<Exited>;
}

interface AcrossADrop {
  readonly before: MessageId;
  readonly missed: MessageId;
  readonly after: MessageId;
}

const TWICE = 2;
const THRICE = 3;
const CONNECTED = "event: connected";
const ITEM = "event: inbox-item";
const FATAL = /^cookout watch stopped: .*\(token_[a-z]+\)$/u;

function exitedWith(result: BinResult): Exited {
  return { exitCode: result.exitCode, ...watchOutput(result) };
}

const secondWatching: Effect.Effect<Watching, never, CookoutUnderTest | SessionNeeds> = Effect.gen(
  function* startWatching() {
    const cookout = yield* CookoutUnderTest;
    const { channel } = yield* cookout.createChannel("room");
    const first = yield* cookout.joinAgent("agent-1");
    const relay = yield* openRelay(cookout.url);
    const second = yield* cookout.joinAgent("watcher", relay.url);
    const watch = yield* Effect.forkScoped(second.cookout("watch"));
    yield* relay.relayed(CONNECTED);
    const deactivateTheWatcher = cookout
      .deactivateIdentity(second.name)
      .pipe(Effect.andThen(relay.cut), Effect.andThen(Fiber.join(watch)), Effect.map(exitedWith));
    return { channel: channel.name, deactivateTheWatcher, first, relay, second };
  },
);

function postWhileDown(
  { channel, first, relay }: Watching,
  text: string,
): Effect.Effect<MessageId, never, SessionNeeds> {
  return Effect.gen(function* postWhileTheRelayIsDown() {
    yield* relay.takeDown;
    const missed = yield* first.post(channel, text);
    yield* relay.bringUp;
    yield* relay.relayed(CONNECTED, TWICE);
    return missed;
  });
}

function mentionOf(label: string, { second }: Pick<Watching, "second">): string {
  return `${label}, @${second.name}.`;
}

function mentionAcrossADrop(watching: Watching): Effect.Effect<AcrossADrop, never, SessionNeeds> {
  return Effect.gen(function* mentionBeforeDuringAndAfter() {
    const { channel, first, relay } = watching;
    const before = yield* first.post(channel, mentionOf("Before the drop", watching));
    yield* relay.relayed(ITEM);
    const missed = yield* postWhileDown(watching, mentionOf("While down", watching));
    yield* relay.relayed(ITEM, TWICE);
    const after = yield* first.post(channel, mentionOf("After", watching));
    yield* relay.relayed(ITEM, THRICE);
    return { after, before, missed };
  });
}

it.live(
  "cookout watch prints one stdout line for each item another agent sends it, a mention and a reply in a thread it follows",
  () =>
    Effect.gen(function* watchTwoItems() {
      const { channel, deactivateTheWatcher, first, relay, second } = yield* secondWatching;
      const question = `Are you there, @${second.name}?`;
      const top = yield* first.post(channel, question);
      const reply = yield* second.post(channel, "Here.", "--reply-to", String(top));
      const thanks = yield* first.post(channel, "Thanks.", "--reply-to", String(reply));
      yield* relay.relayed(ITEM, TWICE);
      const exited = yield* deactivateTheWatcher;
      const from = { author: first.name, channel, thread: top };

      expect(exited).toMatchObject({
        exitCode: watchExitTokenRevoked,
        items: [
          watchLine({ ...from, message: top, text: question }),
          watchLine({ ...from, message: thanks, text: "Thanks." }),
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
      const exited = yield* watching.deactivateTheWatcher;
      const lastEventIds = yield* watching.relay.lastEventIds;
      const from = { author: watching.first.name, channel: watching.channel };

      expect(exited).toMatchObject({
        exitCode: watchExitTokenRevoked,
        items: [
          watchLine({ ...from, message: before, text: mentionOf("Before the drop", watching), thread: before }),
          watchLine({ ...from, message: missed, text: mentionOf("While down", watching), thread: missed }),
          watchLine({ ...from, message: after, text: mentionOf("After", watching), thread: after }),
        ],
      });
      expect(exited.last).toMatch(FATAL);
      expect(lastEventIds).toStrictEqual([null, String(before), String(after)]);
    }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);

it.live("deactivating the watcher's identity ends cookout watch with one fatal stdout line and exit 3", () =>
  Effect.gen(function* watchDeactivated() {
    const { deactivateTheWatcher } = yield* secondWatching;
    const exited = yield* deactivateTheWatcher;

    expect(exited).toMatchObject({ exitCode: watchExitTokenRevoked, items: [] });
    expect(exited.last).toMatch(FATAL);
  }).pipe(Effect.provide([cookoutUnderTest, NodeServices.layer])),
);
