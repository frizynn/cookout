import type { ChannelName, InboxItem, MessageId } from "../../sdk/index.ts";

const NONE = 0;

interface Scope {
  readonly channel: ChannelName;
  readonly thread: MessageId | null;
}

type CountsState =
  | { readonly status: "loaded"; readonly items: readonly InboxItem[] }
  | { readonly status: "loading" | "failed" };

interface CountsStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => CountsState;
}

type WithNewLines<Store> = Store & {
  readonly newLine: (channel: ChannelName, thread: MessageId | null) => NewLine;
};

interface NewLine {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => MessageId | null;
}

function kindIn(item: InboxItem, scope: Scope): boolean {
  if (scope.thread === null) {
    return item.message.kind === "top-level";
  }
  return item.message.kind === "reply" && item.parent.id === scope.thread;
}

function earliest(found: MessageId | null, item: InboxItem): MessageId | null {
  if (found !== null && found < item.message.id) {
    return found;
  }
  return item.message.id;
}

function firstUnread(items: readonly InboxItem[], scope: Scope): MessageId | null {
  let found: MessageId | null = null;
  for (const item of items) {
    if (item.channel.name === scope.channel && kindIn(item, scope)) {
      found = earliest(found, item);
    }
  }
  return found;
}

function createNewLine(counts: CountsStore, scope: Scope): NewLine {
  const listeners = new Set<() => void>();
  let line: MessageId | null = null;
  let taken = false;
  let stop: (() => void) | null = null;

  function take(): void {
    const state = counts.snapshot();
    if (taken || state.status !== "loaded") {
      return;
    }
    taken = true;
    line = firstUnread(state.items, scope);
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    snapshot: () => line,
    subscribe: (listener) => {
      listeners.add(listener);
      stop ??= counts.subscribe(take);
      take();
      return () => {
        listeners.delete(listener);
        if (listeners.size === NONE && stop !== null) {
          stop();
          stop = null;
          taken = false;
          line = null;
        }
      };
    },
  };
}

function withNewLines<Store extends CountsStore>(counts: Store): WithNewLines<Store> {
  const lines = new Map<string, NewLine>();
  return {
    ...counts,
    newLine: (channel, thread) => {
      const key = `${channel}/${String(thread)}`;
      const line = lines.get(key) ?? createNewLine(counts, { channel, thread });
      lines.set(key, line);
      return line;
    },
  };
}

export { withNewLines };
export type { NewLine };
