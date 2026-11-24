import { Array as Arr, Effect, Predicate } from "effect";
import type { ListOpenThreadsQuery, ListOpenThreadsResponse, MessageId, PostMessageRequest } from "../../index.ts";
import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";

const BAD_REQUEST = 400;
const PAGE_OF_TWO = 2;
const FIVE_THREADS = 5;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ALL = { all: true } as const;
const BOOT = "2026-01-01T00:00:00.000Z";
const AN_HOUR_IN = "2026-01-01T01:00:00.000Z";
const THREE_HOURS_IN = "2026-01-01T03:00:00.000Z";

interface Board {
  readonly ann: TestIdentity;
  readonly bob: TestIdentity;
  readonly cat: TestIdentity;
}

function board(cookout: TestCookoutService): Effect.Effect<Board> {
  return Effect.gen(function* annBobAndCat() {
    const ann = yield* cookout.createIdentity("ann");
    const bob = yield* cookout.createIdentity("bob");
    const cat = yield* cookout.createIdentity("cat");
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    return { ann, bob, cat };
  });
}

function post(who: TestIdentity, text: string, ...replyTo: readonly MessageId[]): Effect.Effect<MessageId> {
  const request: PostMessageRequest = Arr.match(replyTo, {
    onEmpty: () => ({ channel: "grill", text }),
    onNonEmpty: ([parent]) => ({ channel: "grill", replyTo: parent, text }),
  });
  return Effect.map(
    answer(() => who.client.createMessage(request)),
    ({ message }) => message.id,
  );
}

const aBoard = Effect.flatMap(TestCookout, board);

const anHourPasses = TestClock.adjust("1 hour");

function openIds(who: TestIdentity, query?: ListOpenThreadsQuery): Effect.Effect<readonly MessageId[]> {
  return Effect.map(
    answer(() => who.client.listOpenThreads(query)),
    ({ threads }) => Arr.map(threads, (thread) => thread.message.id),
  );
}

function nextPage(who: TestIdentity, page: ListOpenThreadsResponse): Effect.Effect<ListOpenThreadsResponse> {
  const { cursor } = page;
  if (Predicate.isNull(cursor)) {
    return Effect.succeed({ cursor, hasMore: false, threads: [] });
  }
  return answer(() => who.client.listOpenThreads({ all: true, cursor, limit: PAGE_OF_TWO }));
}

it.effect("open threads leave out closed ones, come stalest first, and a new reply moves its thread to the end", () =>
  Effect.gen(function* stalestFirst() {
    const { ann, bob } = yield* aBoard;
    const first = yield* post(ann, "first");
    const closed = yield* Effect.andThen(anHourPasses, post(ann, "closed"));
    const [third, fourth] = yield* Effect.andThen(
      anHourPasses,
      Effect.all([post(ann, "third"), post(ann, "fourth")], ONE_AT_A_TIME),
    );
    const before = yield* Effect.andThen(
      answer(() => bob.client.closeThread(closed)),
      openIds(ann, ALL),
    );
    const after = yield* Effect.andThen(
      Effect.andThen(anHourPasses, post(bob, "still on it", first)),
      openIds(ann, ALL),
    );

    expect(before).toStrictEqual([first, third, fourth]);
    expect(after).toStrictEqual([third, fourth, first]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect(
  "without all the caller sees the threads it started, replied in or is mentioned in; with all, every one",
  () =>
    Effect.gen(function* involvingMe() {
      const { ann, bob, cat } = yield* aBoard;
      const started = yield* post(ann, "mine");
      const replied = yield* post(bob, "anyone?");
      const mentioned = yield* post(bob, "@ann look");
      const mentionedInReply = yield* post(bob, "a question");
      const others = yield* post(bob, "not ann's");
      yield* Effect.all(
        [post(ann, "me", replied), post(cat, "@ann this one", mentionedInReply), post(cat, "ok", others)],
        ONE_AT_A_TIME,
      );
      const [mine, all] = yield* Effect.all([openIds(ann), openIds(ann, ALL)], ONE_AT_A_TIME);

      expect(mine).toStrictEqual([started, mentioned, replied, mentionedInReply]);
      expect(all).toStrictEqual([started, mentioned, replied, mentionedInReply, others]);
    }).pipe(Effect.provide(testCookout())),
);

it.effect("lastActivityAt is the latest message's time, or a later reopen's", () =>
  Effect.gen(function* lastActivity() {
    const { ann, bob } = yield* aBoard;
    const quiet = yield* post(ann, "quiet");
    const replied = yield* post(ann, "replied");
    const reopened = yield* post(ann, "reopened");
    yield* Effect.andThen(anHourPasses, post(bob, "a reply", replied));
    yield* Effect.andThen(
      anHourPasses,
      answer(() => bob.client.closeThread(reopened)),
    );
    yield* Effect.andThen(
      anHourPasses,
      answer(() => bob.client.reopenThread(reopened)),
    );
    const { threads } = yield* answer(() => ann.client.listOpenThreads(ALL));

    expect(Arr.map(threads, (thread) => [thread.message.id, thread.lastActivityAt])).toStrictEqual([
      [quiet, BOOT],
      [replied, AN_HOUR_IN],
      [reopened, THREE_HOURS_IN],
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("paging with the cursor walks every open thread once, and hasMore is false on the last page", () =>
  Effect.gen(function* paging() {
    const { ann } = yield* aBoard;
    const posted = yield* Effect.forEach(
      Arr.makeBy(FIVE_THREADS, (index) => `thread ${String(index)}`),
      (text) => post(ann, text),
      ONE_AT_A_TIME,
    );
    const first = yield* answer(() => ann.client.listOpenThreads({ all: true, limit: PAGE_OF_TWO }));
    const second = yield* nextPage(ann, first);
    const last = yield* nextPage(ann, second);
    const pages = [first, second, last];
    const bad = yield* refusal(() => ann.client.listOpenThreads({ cursor: "not a cursor" }));

    expect(Arr.flatMap(pages, (page) => Arr.map(page.threads, (thread) => thread.message.id))).toStrictEqual(posted);
    expect(Arr.map(pages, (page) => [page.hasMore, Predicate.isNull(page.cursor)])).toStrictEqual([
      [true, false],
      [true, false],
      [false, true],
    ]);
    expect(bad).toMatchObject({ status: BAD_REQUEST });
  }).pipe(Effect.provide(testCookout())),
);
