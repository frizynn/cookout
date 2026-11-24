import type { Clock } from "../../format/index.ts";
import type { MessageId } from "../../sdk/index.ts";
import type { Notifier } from "./notifier.ts";
import type { PageFocus } from "../../page-focus/index.ts";
import type { Timer } from "./timer.ts";
import { createNotifier } from "./notifier.ts";
import { createTimer } from "./timer.ts";

const READ_AFTER_MILLIS = 2000;
const NOTE_MILLIS = 5000;
const NONE = 0;
const FIRST = 1;

interface Newest {
  readonly id: MessageId;
  readonly mine: boolean;
}

interface ReaderSources {
  readonly subscribe: (listener: () => void) => () => void;
  readonly newest: () => Newest | null;
  readonly ack: (id: MessageId) => void;
  readonly subscribeToUnread: (listener: () => void) => () => void;
  readonly firstUnread: () => MessageId | null;
  readonly markUnread: (id: MessageId) => void;
}

interface ReaderState {
  readonly marked: boolean;
  readonly held: boolean;
}

interface Reader {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => ReaderState;
  readonly markRead: () => void;
  readonly markUnread: () => void;
}

interface ReaderTools {
  readonly clock: Clock;
  readonly page: PageFocus;
}

interface ReaderMaking extends ReaderTools {
  readonly sources: ReaderSources;
}

interface Seen {
  readonly newest: Newest | null;
  readonly acked: MessageId | null;
  readonly first: MessageId | null;
}

interface Run extends ReaderMaking {
  readonly state: Notifier<ReaderState>;
  readonly seen: Notifier<Seen>;
  readonly reading: Timer;
  readonly note: Timer;
}

const IDLE: ReaderState = { held: false, marked: false };
const NOTHING_SEEN: Seen = { acked: null, first: null, newest: null };

function idOf(newest: Newest | null): MessageId | null {
  if (newest === null) {
    return null;
  }
  return newest.id;
}

function ackNewest(run: Run): void {
  const seen = run.seen.current();
  if (seen.newest !== null) {
    run.seen.publish({ ...seen, acked: seen.newest.id });
    run.sources.ack(seen.newest.id);
  }
}

function canRead(run: Run): boolean {
  const { acked, newest } = run.seen.current();
  return newest !== null && newest.id !== acked && !run.state.current().held && run.page.focused();
}

function arm(run: Run): void {
  run.reading.cancel();
  if (canRead(run)) {
    run.reading.start(READ_AFTER_MILLIS, () => {
      ackNewest(run);
    });
  }
}

function markRead(run: Run): void {
  run.reading.cancel();
  ackNewest(run);
  run.note.start(NOTE_MILLIS, () => {
    run.state.publish({ ...run.state.current(), marked: false });
  });
  run.state.publish({ ...run.state.current(), marked: true });
}

function isReply(before: Newest | null, next: Newest | null): boolean {
  if (before === null || next === null) {
    return false;
  }
  return next.mine;
}

function shownChanged(run: Run): void {
  const before = run.seen.current();
  const next = run.sources.newest();
  if (idOf(next) === idOf(before.newest)) {
    return;
  }
  run.seen.publish({ ...before, newest: next });
  if (isReply(before.newest, next)) {
    markRead(run);
    return;
  }
  arm(run);
}

function unreadChanged(run: Run): void {
  const seen = run.seen.current();
  if (seen.first === null) {
    run.seen.publish({ ...seen, first: run.sources.firstUnread() });
  }
}

function markUnread(run: Run): void {
  const { first, newest } = run.seen.current();
  const from = first ?? idOf(newest);
  if (from === null) {
    return;
  }
  run.reading.cancel();
  run.note.cancel();
  run.state.publish({ held: true, marked: false });
  run.sources.markUnread(from);
}

function start(run: Run): readonly (() => void)[] {
  const stops = [
    run.sources.subscribe(() => {
      shownChanged(run);
    }),
    run.sources.subscribeToUnread(() => {
      unreadChanged(run);
    }),
    run.page.subscribe(() => {
      arm(run);
    }),
  ];
  unreadChanged(run);
  shownChanged(run);
  return stops;
}

function stop(run: Run, stops: readonly (() => void)[]): void {
  for (const each of stops) {
    each();
  }
  run.reading.cancel();
  run.note.cancel();
  run.state.publish(IDLE);
  run.seen.publish(NOTHING_SEEN);
}

function createReader(making: ReaderMaking): Reader {
  const run: Run = {
    ...making,
    note: createTimer(making.clock),
    reading: createTimer(making.clock),
    seen: createNotifier(NOTHING_SEEN),
    state: createNotifier(IDLE),
  };
  let stops: readonly (() => void)[] = [];
  let count = NONE;
  return {
    markRead: () => {
      markRead(run);
    },
    markUnread: () => {
      markUnread(run);
    },
    snapshot: run.state.current,
    subscribe: (listener) => {
      const leave = run.state.subscribe(listener);
      count += FIRST;
      if (count === FIRST) {
        stops = start(run);
      }
      return () => {
        leave();
        count -= FIRST;
        if (count === NONE) {
          stop(run, stops);
        }
      };
    },
  };
}

export { type Newest, type Reader, type ReaderSources, type ReaderState, type ReaderTools, createReader };
