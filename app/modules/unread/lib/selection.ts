import type { ChannelName, InboxItem, MessageId } from "../../sdk/index.ts";

const NONE = 0;

interface SelectionState {
  readonly items: readonly InboxItem[];
  readonly expanded: boolean;
}

interface Selection {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => SelectionState;
  readonly expand: () => void;
}

interface Scope {
  readonly channel: ChannelName;
  readonly thread: MessageId;
}

interface ItemsStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () =>
    | { readonly status: "loaded"; readonly inbox: readonly InboxItem[] }
    | { readonly status: string };
}

const EMPTY: SelectionState = { expanded: false, items: [] };

function inScope(item: InboxItem, scope: Scope | null): boolean {
  return (
    scope !== null &&
    item.message.kind === "reply" &&
    item.parent.id === scope.thread &&
    item.channel.name === scope.channel
  );
}

function idsOf(items: readonly InboxItem[]): string {
  return items.map((item) => String(item.message.id)).join(" ");
}

function unreadIn(store: ItemsStore, scope: Scope | null): readonly InboxItem[] {
  const state = store.snapshot();
  if (!("inbox" in state)) {
    return [];
  }
  return state.inbox.filter((item) => inScope(item, scope));
}

function createSelection(store: ItemsStore, scope: Scope | null): Selection {
  const listeners = new Set<() => void>();
  let state = EMPTY;
  let stop: (() => void) | null = null;

  function publish(next: SelectionState): void {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function take(): void {
    const items = unreadIn(store, scope);
    if (items.length > NONE && idsOf(items) !== idsOf(state.items)) {
      publish({ ...state, items });
    }
  }

  return {
    expand: () => {
      publish({ ...state, expanded: true });
    },
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      stop ??= store.subscribe(take);
      take();
      return () => {
        listeners.delete(listener);
        if (listeners.size === NONE && stop !== null) {
          stop();
          stop = null;
          state = EMPTY;
        }
      };
    },
  };
}

function keyOf(scope: Scope | null): string {
  if (scope === null) {
    return "";
  }
  return `${scope.channel}/${String(scope.thread)}`;
}

function createSelections(store: ItemsStore): (scope: Scope | null) => Selection {
  const selections = new Map<string, Selection>();
  return (scope) => {
    const key = keyOf(scope);
    const selection = selections.get(key) ?? createSelection(store, scope);
    selections.set(key, selection);
    return selection;
  };
}

export { type Selection, createSelections };
