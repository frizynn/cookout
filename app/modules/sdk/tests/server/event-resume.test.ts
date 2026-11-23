import { Array as Arr, Deferred, Effect, Option, Order, String as Str, Stream, pipe } from "effect";
import type { CookoutEvent, EventStream, WatchOptions } from "../../index.ts";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { HttpClientResponse } from "effect/http";
import type { MessageId } from "../../../messages/index.ts";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";
import { eventsPath } from "../../../events/index.ts";

const ONE_AT_A_TIME = { concurrency: 1 } as const;

interface Board {
  readonly ann: TestIdentity;
  readonly bob: TestIdentity;
}

function board(cookout: TestCookoutService): Effect.Effect<Board> {
  return Effect.gen(function* annAndBob() {
    const ann = yield* cookout.createIdentity("ann");
    const bob = yield* cookout.createIdentity("bob");
    yield* answer(() => ann.client.createChannel({ name: "grill" }));
    return { ann, bob };
  });
}

function watching(
  who: TestIdentity,
  options: WatchOptions,
): Effect.Effect<AsyncIterator<CookoutEvent>, never, Scope.Scope> {
  return Effect.map(
    Effect.acquireRelease(
      answer(() => who.client.watch(options)),
      (events: EventStream) => answer(() => events.close()),
    ),
    (events) => events[Symbol.asyncIterator](),
  );
}

function mentionBob(ann: TestIdentity, text: string): Effect.Effect<MessageId> {
  return Effect.map(
    answer(() => ann.client.createMessage({ channel: "grill", text: `@bob ${text}` })),
    ({ message }) => message.id,
  );
}

function nextEvent(events: AsyncIterator<CookoutEvent>): Effect.Effect<IteratorResult<CookoutEvent>> {
  return answer(() => events.next());
}

function itemFor(id: MessageId): object {
  return { done: false, value: { item: { message: { id } } } };
}

it.effect("a reconnect with Last-Event-ID replays only the missed items, then live items follow, none twice", () =>
  Effect.gen(function* resumeAfterDrop() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const seen = yield* mentionBob(ann, "seen before the drop");
    const missed = yield* Effect.forEach(["missed one", "missed two"], (text) => mentionBob(ann, text), ONE_AT_A_TIME);
    const events = yield* watching(bob, { lastEventId: seen });
    const replayed = [yield* nextEvent(events), yield* nextEvent(events)];
    const live = yield* mentionBob(ann, "live");
    const afterReplay = yield* nextEvent(events);

    expect(replayed).toMatchObject(Arr.map(missed, itemFor));
    expect(afterReplay).toMatchObject(itemFor(live));
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a reconnect with Last-Event-ID that missed nothing goes straight on with live items", () =>
  Effect.gen(function* resumeWithNothingMissed() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const seen = yield* mentionBob(ann, "seen before the drop");
    const events = yield* watching(bob, { lastEventId: seen });
    const live = yield* mentionBob(ann, "live");
    const next = yield* nextEvent(events);

    expect(next).toMatchObject(itemFor(live));
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an idle stream sends a heartbeat after 15 s", () =>
  Effect.gen(function* heartbeatArrives() {
    const cookout = yield* TestCookout;
    const { bob } = yield* board(cookout);
    const heartbeat = yield* Deferred.make<string>();
    const beats: string[] = [];
    const events = yield* watching(bob, {
      onHeartbeat: () => {
        beats.push("heartbeat");
        Deferred.doneUnsafe(heartbeat, Effect.succeed("heartbeat"));
      },
    });
    yield* Effect.forkScoped(nextEvent(events));
    yield* TestClock.adjust("15 seconds");
    yield* Deferred.await(heartbeat);

    expect(beats).toStrictEqual(["heartbeat"]);
  }).pipe(Effect.provide(testCookout())),
);

const ID_FIELD = "id: ";

function streamTextUntil(response: HttpClientResponse.HttpClientResponse, marker: string): Effect.Effect<string> {
  return response.stream.pipe(
    Stream.decodeText,
    Stream.scan(
      () => "",
      (text, chunk) => text + chunk,
    ),
    Stream.takeUntil(Str.includes(marker)),
    Stream.runLast,
    Effect.map(Option.getOrElse(() => "")),
    Effect.orDie,
  );
}

function sentIds(text: string): readonly number[] {
  return pipe(
    Str.split(text, "\n"),
    Arr.filter(Str.startsWith(ID_FIELD)),
    Arr.map((line) => Number(Str.slice(ID_FIELD.length)(line))),
  );
}

it.effect("the event IDs on one stream strictly increase, whatever kinds of event it carries", () =>
  Effect.gen(function* idsIncrease() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const response = yield* HttpClientRequest.get(`${cookout.url}${eventsPath}?channels=all`).pipe(
      HttpClientRequest.setHeader("authorization", `Bearer ${bob.token}`),
      HttpClient.execute,
      Effect.orDie,
    );
    const first = yield* mentionBob(ann, "first");
    yield* mentionBob(ann, "second");
    yield* answer(() => bob.client.ack(first));
    const text = yield* streamTextUntil(response, "event: read-position");
    const ids = sentIds(text);

    expect(ids).toStrictEqual(Arr.sort(Arr.dedupe(ids), Order.Number));
  }).pipe(Effect.provide([testCookout(), FetchHttpClient.layer])),
);
