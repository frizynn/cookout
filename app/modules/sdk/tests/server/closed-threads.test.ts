import { Array as Arr, Effect } from "effect";
import type {
  CookoutClient,
  CookoutEvent,
  EventStream,
  MessageId,
  PostMessageRequest,
  WatchOptions,
} from "../../index.ts";
import { TestCookout, answer, messageId, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";

const MISSING = 999;
const NOT_FOUND = 404;
const UNAUTHORIZED = 401;
const BOOT = "2026-01-01T00:00:00.000Z";
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ALL_CHANNELS = { allChannels: true } as const;

interface Board {
  readonly ann: TestIdentity;
  readonly bob: TestIdentity;
}

function board(cookout: TestCookoutService): Effect.Effect<Board> {
  return Effect.gen(function* annAndBob() {
    const ann = yield* cookout.createIdentity("ann");
    const bob = yield* cookout.createIdentity("bob");
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    return { ann, bob };
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

type EventType = CookoutEvent["type"];

interface Feed {
  readonly next: (type: EventType) => Effect.Effect<unknown>;
}

function isOfType(type: EventType): (next: Readonly<IteratorResult<CookoutEvent, unknown>>) => boolean {
  return (next) => next.done !== true && next.value.type === type;
}

function feedOf(events: EventStream): Feed {
  const all = events[Symbol.asyncIterator]();
  return {
    next: (type) =>
      answer(() => all.next()).pipe(
        Effect.repeat({ until: isOfType(type) }),
        Effect.map((next: Readonly<IteratorResult<CookoutEvent, unknown>>): unknown => next.value),
      ),
  };
}

function watching(client: CookoutClient, options?: WatchOptions): Effect.Effect<Feed, never, Scope.Scope> {
  return Effect.map(
    Effect.acquireRelease(
      answer(() => client.watch(options)),
      (events: EventStream) => answer(() => events.close()),
    ),
    feedOf,
  );
}

it.effect("closing a thread by a reply's ID shows who closed it and when on its page, thread and inbox items", () =>
  Effect.gen(function* closeByReply() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const parent = yield* post(ann, "deploy main?");
    const reply = yield* post(ann, "@bob can you check?", parent);
    const { message } = yield* answer(() => bob.client.closeThread(reply));
    const [page, thread, inbox] = yield* Effect.all(
      [
        answer(() => ann.client.listMessages("grill")),
        answer(() => ann.client.getThread(reply)),
        answer(() => bob.client.inbox()),
      ],
      ONE_AT_A_TIME,
    );

    expect(message).toMatchObject({ closedAt: BOOT, closedBy: "bob", id: parent, replyCount: 1 });
    expect([page.messages, thread.parent]).toStrictEqual([[message], message]);
    expect(Arr.map(inbox.items, (item) => item.parent)).toStrictEqual([message]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("reopening a thread removes who closed it and when, everywhere it shows", () =>
  Effect.gen(function* reopenClears() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const parent = yield* post(ann, "deploy main?");
    const reply = yield* post(ann, "@bob can you check?", parent);
    yield* answer(() => bob.client.closeThread(parent));
    const { message } = yield* answer(() => ann.client.reopenThread(reply));
    const [page, inbox] = yield* Effect.all(
      [answer(() => ann.client.listMessages("grill")), answer(() => bob.client.inbox())],
      ONE_AT_A_TIME,
    );

    expect(message).not.toHaveProperty("closedAt");
    expect(message).not.toHaveProperty("closedBy");
    expect([page.messages, Arr.map(inbox.items, (item) => item.parent)]).toStrictEqual([[message], [message]]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a top-level message with no replies can be closed and reopened", () =>
  Effect.gen(function* closeUnreplied() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const parent = yield* post(ann, "anyone around?");
    const closed = yield* answer(() => bob.client.closeThread(parent));
    const open = yield* answer(() => bob.client.reopenThread(parent));

    expect(closed.message).toMatchObject({ closedAt: BOOT, closedBy: "bob", id: parent, replyCount: 0 });
    expect(open.message).not.toHaveProperty("closedAt");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a second close keeps the first closer and time, and reopening an open thread changes nothing", () =>
  Effect.gen(function* idempotent() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const parent = yield* post(ann, "deploy main?");
    const first = yield* answer(() => bob.client.closeThread(parent));
    const second = yield* answer(() => ann.client.closeThread(parent));
    const open = yield* answer(() => ann.client.reopenThread(parent));
    const again = yield* answer(() => ann.client.reopenThread(parent));

    expect(second).toStrictEqual(first);
    expect(again).toStrictEqual(open);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("closing or reopening a missing message is 404, and a Deactivated identity's close is refused", () =>
  Effect.gen(function* refusals() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const parent = yield* post(ann, "deploy main?");
    yield* answer(() => cookout.client.deactivateIdentity("bob"));
    const refused = yield* Effect.all(
      [
        refusal(() => ann.client.closeThread(messageId(MISSING))),
        refusal(() => ann.client.reopenThread(messageId(MISSING))),
        refusal(() => bob.client.closeThread(parent)),
        refusal(() => bob.client.reopenThread(parent)),
      ],
      ONE_AT_A_TIME,
    );
    const thread = yield* answer(() => ann.client.getThread(parent));

    expect(refused).toMatchObject([
      { code: "message_not_found", status: NOT_FOUND },
      { code: "message_not_found", status: NOT_FOUND },
      { code: "token_revoked", status: UNAUTHORIZED },
      { code: "token_revoked", status: UNAUTHORIZED },
    ]);
    expect(thread.parent).not.toHaveProperty("closedAt");
  }).pipe(Effect.provide(testCookout({ secrets: "live" }))),
);

it.effect("a reply posted in a closed thread reopens it, as its message event and the thread both show", () =>
  Effect.gen(function* replyReopens() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const parent = yield* post(ann, "deploy main?");
    const feed = yield* Effect.andThen(
      answer(() => ann.client.closeThread(parent)),
      watching(ann.client, ALL_CHANNELS),
    );
    const posted = yield* answer(() =>
      bob.client.createMessage({ channel: "grill", replyTo: parent, text: "not yet" }),
    );
    const [event, thread] = yield* Effect.all(
      [feed.next("message"), answer(() => ann.client.getThread(parent))],
      ONE_AT_A_TIME,
    );

    expect(event).toStrictEqual({ message: posted.message, type: "message" });
    expect(thread.parent).toMatchObject({ id: parent, replyCount: 1 });
    expect(thread.parent).not.toHaveProperty("closedAt");
    expect(thread.parent).not.toHaveProperty("closedBy");
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the all-channels feed sends a thread event for a close, a reopen and a reopening reply", () =>
  Effect.gen(function* threadEventsArrive() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* board(cookout);
    const parent = yield* post(ann, "deploy main?");
    const feed = yield* watching(bob.client, ALL_CHANNELS);
    const [closed, afterClose] = yield* Effect.all(
      [answer(() => ann.client.closeThread(parent)), feed.next("thread")],
      ONE_AT_A_TIME,
    );
    const [open, afterReopen] = yield* Effect.all(
      [answer(() => ann.client.reopenThread(parent)), feed.next("thread")],
      ONE_AT_A_TIME,
    );
    yield* Effect.all([answer(() => ann.client.closeThread(parent)), feed.next("thread")], ONE_AT_A_TIME);
    const [, afterReply, thread] = yield* Effect.all(
      [post(bob, "one more thing", parent), feed.next("thread"), answer(() => bob.client.getThread(parent))],
      ONE_AT_A_TIME,
    );

    expect([afterClose, afterReopen, afterReply]).toStrictEqual([
      { parent: closed.message, type: "thread" },
      { parent: open.message, type: "thread" },
      { parent: thread.parent, type: "thread" },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect(
  "closing moves no read position, and a closed thread's unread messages stay in the inbox and arrive live",
  () =>
    Effect.gen(function* closingHidesNothing() {
      const cookout = yield* TestCookout;
      const { ann, bob } = yield* board(cookout);
      const parent = yield* post(ann, "@bob deploy main?");
      const before = yield* answer(() => bob.client.readPositions());
      const feed = yield* Effect.andThen(
        answer(() => ann.client.closeThread(parent)),
        watching(bob.client),
      );
      const mention = yield* post(ann, "@bob still there?", parent);
      const [live, after, inbox] = yield* Effect.all(
        [
          Effect.andThen(
            answer(() => ann.client.closeThread(parent)),
            feed.next("inbox-item"),
          ),
          answer(() => bob.client.readPositions()),
          answer(() => bob.client.inbox()),
        ],
        ONE_AT_A_TIME,
      );

      expect(after).toStrictEqual(before);
      expect(live).toMatchObject({ item: { message: { id: mention } }, type: "inbox-item" });
      expect(Arr.map(inbox.items, (item) => item.message.id)).toStrictEqual([parent, mention]);
    }).pipe(Effect.provide(testCookout())),
);
