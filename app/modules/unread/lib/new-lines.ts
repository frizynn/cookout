import type { ChannelName, MessageId } from "../../sdk/index.ts";

const NONE = 0;
const BEFORE_EVERY_MESSAGE = 0;

interface Scope {
  readonly channel: ChannelName;
  readonly thread: MessageId | null;
}

type ReadPositionOf = (channel: ChannelName, thread: MessageId | null) => MessageId | null;

type MovesBackOf = (channel: ChannelName, thread: MessageId | null) => number;

interface CountsStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => { readonly status: string };
}

type WithNewLines<Store> = Omit<Store, "movesBack" | "readPosition"> & {
  readonly newLine: (channel: ChannelName, thread: MessageId | null) => NewLine;
};

interface NewLine {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => number | null;
}

interface Lining {
  readonly counts: CountsStore;
  readonly readPosition: ReadPositionOf;
  readonly movesBack: MovesBackOf;
  readonly scope: Scope;
}

function lineOf(position: MessageId | null, movedBack: number): number | null {
  if (position === null && movedBack > NONE) {
    return BEFORE_EVERY_MESSAGE;
  }
  return position;
}

function createNewLine({ counts, movesBack, readPosition, scope }: Lining): NewLine {
  const listeners = new Set<() => void>();
  let line: number | null = null;
  let taken = false;
  let moves = NONE;
  let stop: (() => void) | null = null;

  function take(): void {
    const state = counts.snapshot();
    const movedBack = movesBack(scope.channel, scope.thread);
    if ((taken && moves === movedBack) || state.status !== "loaded") {
      return;
    }
    taken = true;
    moves = movedBack;
    line = lineOf(readPosition(scope.channel, scope.thread), movedBack);
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

type Lines<Store> = Store & { readonly readPosition: ReadPositionOf; readonly movesBack: MovesBackOf };

function withNewLines<Store extends CountsStore>({
  movesBack,
  readPosition,
  ...counts
}: Lines<Store>): WithNewLines<Lines<Store>> {
  const lines = new Map<string, NewLine>();
  return {
    ...counts,
    newLine: (channel, thread) => {
      const key = `${channel}/${String(thread)}`;
      const line = lines.get(key) ?? createNewLine({ counts, movesBack, readPosition, scope: { channel, thread } });
      lines.set(key, line);
      return line;
    },
  };
}

export { withNewLines };
export type { NewLine };
