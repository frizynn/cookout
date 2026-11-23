import type { ChannelName, MessageId } from "../../sdk/index.ts";

const NONE = 0;

interface Scope {
  readonly channel: ChannelName;
  readonly thread: MessageId | null;
}

type ReadPositionOf = (channel: ChannelName, thread: MessageId | null) => MessageId | null;

interface CountsStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => { readonly status: string };
}

type WithNewLines<Store> = Omit<Store, "readPosition"> & {
  readonly newLine: (channel: ChannelName, thread: MessageId | null) => NewLine;
};

interface NewLine {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => MessageId | null;
}

interface Lining {
  readonly counts: CountsStore;
  readonly readPosition: ReadPositionOf;
  readonly scope: Scope;
}

function createNewLine({ counts, readPosition, scope }: Lining): NewLine {
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
    line = readPosition(scope.channel, scope.thread);
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

type Lines<Store> = Store & { readonly readPosition: ReadPositionOf };

function withNewLines<Store extends CountsStore>({
  readPosition,
  ...counts
}: Lines<Store>): WithNewLines<Lines<Store>> {
  const lines = new Map<string, NewLine>();
  return {
    ...counts,
    newLine: (channel, thread) => {
      const key = `${channel}/${String(thread)}`;
      const line = lines.get(key) ?? createNewLine({ counts, readPosition, scope: { channel, thread } });
      lines.set(key, line);
      return line;
    },
  };
}

export { withNewLines };
export type { NewLine };
