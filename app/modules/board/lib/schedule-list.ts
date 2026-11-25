import type { ChannelName, Refusal } from "../../sdk/index.ts";
import type { ScheduleChange } from "./board-calls.ts";
import type { ScheduledMessageId } from "../../scheduled-messages/index.ts";
import { refusalOf } from "../../sdk/index.ts";
import { sameSnapshot } from "./selected.ts";

type ScheduleChangeState =
  | { readonly status: "idle" }
  | { readonly status: "changing"; readonly id: ScheduledMessageId }
  | (Refusal & { readonly status: "failed"; readonly id: ScheduledMessageId });

interface ScheduleListState {
  readonly channel: ChannelName | null;
  readonly selected: ScheduledMessageId | null;
  readonly deleting: ScheduledMessageId | null;
  readonly change: ScheduleChangeState;
}

interface ScheduleList {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => ScheduleListState;
  readonly open: (channel: ChannelName, selected: ScheduledMessageId | null) => void;
  readonly close: () => void;
  readonly askDelete: (id: ScheduledMessageId) => void;
  readonly cancelDelete: () => void;
  readonly change: (id: ScheduledMessageId, change: ScheduleChange) => void;
}

interface ScheduleListOptions {
  readonly change: (id: ScheduledMessageId, change: ScheduleChange) => Promise<void>;
}

const IDLE: ScheduleChangeState = { status: "idle" };
const CLOSED: ScheduleListState = { change: IDLE, channel: null, deleting: null, selected: null };

async function after(previous: Promise<void>, step: () => Promise<void>): Promise<void> {
  await previous;
  await step();
}

function createScheduleList(options: ScheduleListOptions): ScheduleList {
  const listeners = new Set<() => void>();
  let current = CLOSED;
  let changes = Promise.resolve();
  function publish(next: ScheduleListState): void {
    if (sameSnapshot({ after: next, before: current })) {
      return;
    }
    current = next;
    for (const listener of listeners) {
      listener();
    }
  }
  async function changing(id: ScheduledMessageId, change: ScheduleChange): Promise<void> {
    publish({ ...current, change: { id, status: "changing" } });
    try {
      await options.change(id, change);
      publish({ ...current, change: IDLE, deleting: null });
    } catch (error: unknown) {
      publish({ ...current, change: { ...refusalOf(error), id, status: "failed" } });
    }
  }
  return {
    askDelete: (id) => {
      publish({ ...current, change: IDLE, deleting: id });
    },
    cancelDelete: () => {
      publish({ ...current, change: IDLE, deleting: null });
    },
    change: (id, change) => {
      changes = after(changes, async () => {
        await changing(id, change);
      });
    },
    close: () => {
      publish(CLOSED);
    },
    open: (channel, selected) => {
      publish({ ...CLOSED, channel, selected });
    },
    snapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type ScheduleList, type ScheduleListState, createScheduleList };
