import { Array as Arr, DateTime, Duration, Effect, Option, Order, Predicate } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { InboxHistoryNudge, NudgeId, NudgeKind } from "../../../inbox/index.ts";
import type { MessageId, OpenThread } from "../../../messages/index.ts";
import type { IdentitiesSection } from "./identities.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { MessagesSection } from "./messages.ts";
import type { OpenThreadsCursor } from "./open-threads.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { isoTimeOf } from "../../../time/server.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

type NudgeIntervals = Readonly<Record<NudgeKind, number>>;

interface NudgeRecord {
  readonly id: NudgeId;
  readonly thread: MessageId;
  readonly recipient: IdentityName | null;
  readonly kind: NudgeKind;
  readonly raisedAt: IsoTime;
  readonly read: boolean;
}

type NewNudgeRecord = Omit<NudgeRecord, "id" | "read">;

type StoredNudge = Omit<InboxHistoryNudge, "channel" | "text"> & { readonly recipient: IdentityName };

interface NudgeRecords {
  readonly since: Effect.Effect<IsoTime, StorageUnavailable>;
  readonly insert: (record: NewNudgeRecord) => Fails<NudgeRecord>;
  readonly latestPerThread: Effect.Effect<readonly NudgeRecord[], StorageUnavailable>;
  readonly ofRecipient: (recipient: IdentityName) => Fails<readonly NudgeRecord[]>;
  readonly markRead: (recipient: IdentityName, ids: readonly NudgeId[]) => Fails<void>;
}

interface NudgesSection {
  readonly nextNudgeDue: (intervals: NudgeIntervals) => Fails<IsoTime | null>;
  readonly raiseDueNudges: (now: IsoTime, intervals: NudgeIntervals) => Fails<readonly StoredNudge[]>;
  readonly listNudges: (recipient: IdentityName, which: "unread" | "all") => Fails<readonly StoredNudge[]>;
  readonly markNudgeRead: (recipient: IdentityName, id: NudgeId) => Fails<StoredNudge | null>;
  readonly markNudgesReadUpTo: (recipient: IdentityName, upTo: NudgeId) => Fails<void>;
}

type NudgeSources = Pick<MessagesSection, "getThread" | "listOpenThreads"> &
  Pick<IdentitiesSection, "findIdentityByName">;

interface NudgesOn {
  readonly records: NudgeRecords;
  readonly messages: Pick<MessagesSection, "getThread" | "listOpenThreads">;
  readonly identities: Pick<IdentitiesSection, "findIdentityByName">;
  readonly atomically: (
    work: Effect.Effect<readonly StoredNudge[], StorageUnavailable>,
  ) => Effect.Effect<readonly StoredNudge[], StorageUnavailable>;
}

interface Due {
  readonly at: IsoTime;
  readonly kind: NudgeKind;
  readonly thread: OpenThread;
}

interface Dating {
  readonly intervals: NudgeIntervals;
  readonly latest: ReadonlyMap<MessageId, NudgeRecord>;
  readonly since: IsoTime;
}

interface Gathering {
  readonly after: OpenThreadsCursor | null;
  readonly gathered: readonly OpenThread[];
}

interface Raising {
  readonly due: Due;
  readonly now: IsoTime;
  readonly on: NudgesOn;
}

interface Shown {
  readonly open: ReadonlyMap<MessageId, OpenThread>;
  readonly on: NudgesOn;
  readonly recipient: IdentityName;
}

const OPEN_THREADS_PAGE = 500;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ANYONE = Option.getOrThrow(Option.liftPredicate("anyone", isIdentityName));

const byAt: Order.Order<Due> = Order.mapInput(Order.String, (due: Due) => due.at);

function later(at: IsoTime, days: number): IsoTime {
  return isoTimeOf(DateTime.addDuration(DateTime.makeUnsafe(at), Duration.days(days)));
}

function dueOf({ intervals, latest, since }: Dating): (thread: OpenThread) => readonly Due[] {
  return (thread) => {
    const { lastActivityAt } = thread;
    const newest = latest.get(thread.message.id);
    if (lastActivityAt < since) {
      return [];
    }
    if (Predicate.isUndefined(newest) || newest.raisedAt <= lastActivityAt) {
      return [{ at: later(lastActivityAt, intervals.first), kind: "first", thread }];
    }
    if (newest.kind === "first") {
      return [{ at: later(newest.raisedAt, intervals.second), kind: "second", thread }];
    }
    return [];
  };
}

function cursorAfter(threads: readonly OpenThread[]): OpenThreadsCursor | null {
  return Option.getOrNull(
    Option.map(Arr.last(threads), ({ lastActivityAt, message }) => ({ id: message.id, lastActivityAt })),
  );
}

function pageAfter(after: OpenThreadsCursor | null): { readonly after?: OpenThreadsCursor } {
  if (after === null) {
    return {};
  }
  return { after };
}

function allOpenThreads(messages: NudgesOn["messages"], { after, gathered }: Gathering): Fails<readonly OpenThread[]> {
  const page = { all: true, limit: OPEN_THREADS_PAGE, ...pageAfter(after) };
  return Effect.flatMap(messages.listOpenThreads(ANYONE, page), ({ hasMore, threads }) => {
    const all = [...gathered, ...threads];
    if (!hasMore) {
      return Effect.succeed(all);
    }
    return allOpenThreads(messages, { after: cursorAfter(threads), gathered: all });
  });
}

function everyOpenThread(messages: NudgesOn["messages"]): Fails<readonly OpenThread[]> {
  return allOpenThreads(messages, { after: null, gathered: [] });
}

function dueNudges({ messages, records }: NudgesOn, intervals: NudgeIntervals): Fails<readonly Due[]> {
  return Effect.gen(function* listDueNudges() {
    const since = yield* records.since;
    const latest = yield* records.latestPerThread;
    const threads = yield* everyOpenThread(messages);
    const byThread = new Map(Arr.map(latest, (record) => [record.thread, record] as const));
    return Arr.sort(Arr.flatMap(threads, dueOf({ intervals, latest: byThread, since })), byAt);
  });
}

function isActive(identity: Identity | undefined): identity is Identity {
  return Predicate.isNotUndefined(identity) && identity.deactivated !== true;
}

function ownerOf(identities: NudgesOn["identities"], author: Identity): Fails<IdentityName | null> {
  if (author.kind === "human") {
    return Effect.succeed(null);
  }
  return Effect.map(identities.findIdentityByName(author.owner), (owner) => {
    if (isActive(owner)) {
      return owner.name;
    }
    return null;
  });
}

function recipientOf(identities: NudgesOn["identities"], starter: IdentityName): Fails<IdentityName | null> {
  return Effect.flatMap(identities.findIdentityByName(starter), (author) => {
    if (Predicate.isUndefined(author)) {
      return Effect.succeed(null);
    }
    if (isActive(author)) {
      return Effect.succeed(author.name);
    }
    return ownerOf(identities, author);
  });
}

function raise({ due, now, on }: Raising): Fails<readonly StoredNudge[]> {
  return Effect.gen(function* raiseNudge() {
    const parent = due.thread.message;
    const recipient = yield* recipientOf(on.identities, parent.author.name);
    const record = yield* on.records.insert({ kind: due.kind, raisedAt: now, recipient, thread: parent.id });
    if (recipient === null) {
      return [];
    }
    return [{ id: record.id, kind: record.kind, parent, raisedAt: record.raisedAt, read: false, recipient }];
  });
}

function isUnread(open: Shown["open"], record: NudgeRecord): boolean {
  const thread = open.get(record.thread);
  return !record.read && Predicate.isNotUndefined(thread) && thread.lastActivityAt < record.raisedAt;
}

function shownNudge({ on, open, recipient }: Shown): (record: NudgeRecord) => Fails<readonly StoredNudge[]> {
  return (record) =>
    Effect.map(on.messages.getThread(record.thread), (found) =>
      Arr.map(Arr.fromNullishOr(found), ({ parent }) => ({
        id: record.id,
        kind: record.kind,
        parent,
        raisedAt: record.raisedAt,
        read: !isUnread(open, record),
        recipient,
      })),
    );
}

function openThreadsFor(on: NudgesOn, records: readonly NudgeRecord[]): Fails<ReadonlyMap<MessageId, OpenThread>> {
  if (Arr.every(records, (record) => record.read)) {
    return Effect.succeed(new Map());
  }
  return Effect.map(
    everyOpenThread(on.messages),
    (threads) => new Map(Arr.map(threads, (thread) => [thread.message.id, thread] as const)),
  );
}

function listed(on: NudgesOn, recipient: IdentityName): Fails<readonly StoredNudge[]> {
  return Effect.gen(function* listNudges() {
    const records = yield* on.records.ofRecipient(recipient);
    const open = yield* openThreadsFor(on, records);
    const shown = yield* Effect.forEach(records, shownNudge({ on, open, recipient }), ONE_AT_A_TIME);
    return Arr.flatten(shown);
  });
}

function markOne(on: NudgesOn, recipient: IdentityName, id: NudgeId): Fails<StoredNudge | null> {
  return Effect.gen(function* markNudgeRead() {
    const owned = yield* on.records.ofRecipient(recipient);
    if (!Arr.some(owned, (record) => record.id === id)) {
      return null;
    }
    yield* on.records.markRead(recipient, [id]);
    const all = yield* listed(on, recipient);
    return Option.getOrNull(Arr.findFirst(all, (nudge) => nudge.id === id));
  });
}

function markUpTo(on: NudgesOn, recipient: IdentityName, upTo: NudgeId): Fails<void> {
  return Effect.flatMap(on.records.ofRecipient(recipient), (owned) => {
    const unread = Arr.filter(owned, (record) => !record.read && record.id <= upTo);
    return on.records.markRead(
      recipient,
      Arr.map(unread, (record) => record.id),
    );
  });
}

function raiseDue(on: NudgesOn, now: IsoTime, intervals: NudgeIntervals): Fails<readonly StoredNudge[]> {
  return Effect.flatMap(dueNudges(on, intervals), (due) => {
    const ready = Arr.filter(due, ({ at }) => at <= now);
    return Effect.map(
      Effect.forEach(ready, (raising) => raise({ due: raising, now, on }), ONE_AT_A_TIME),
      Arr.flatten,
    );
  });
}

function nudgesOn(on: NudgesOn): NudgesSection {
  return {
    listNudges: (recipient, which) =>
      Effect.map(listed(on, recipient), (all) => Arr.filter(all, (nudge) => which === "all" || !nudge.read)),
    markNudgeRead: (recipient, id) => markOne(on, recipient, id),
    markNudgesReadUpTo: (recipient, upTo) => markUpTo(on, recipient, upTo),
    nextNudgeDue: (intervals) =>
      Effect.map(dueNudges(on, intervals), (due) => Option.getOrNull(Option.map(Arr.head(due), ({ at }) => at))),
    raiseDueNudges: (now, intervals) => on.atomically(raiseDue(on, now, intervals)),
  };
}

export {
  type NewNudgeRecord,
  type NudgeIntervals,
  type NudgeRecord,
  type NudgeRecords,
  type NudgeSources,
  type NudgesOn,
  type NudgesSection,
  type StoredNudge,
  nudgesOn,
};
