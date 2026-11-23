import type { CookoutClient, CookoutEvent, OpenThread, Refusal, Reply, TopLevelMessage } from "../../sdk/index.ts";
import type { Live } from "../../live/index.ts";
import { refusalOf } from "../../sdk/index.ts";
import { withNewestReply } from "../../messages/index.ts";

type MoreState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | (Refusal & { readonly status: "failed" });

type OpenThreadsState =
  | { readonly status: "loading" }
  | {
      readonly status: "loaded";
      readonly threads: readonly OpenThread[];
      readonly cursor: string | null;
      readonly more: MoreState;
    }
  | (Refusal & { readonly status: "failed" });

type LoadedState = Extract<OpenThreadsState, { readonly status: "loaded" }>;

interface OpenThreads {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => OpenThreadsState;
  readonly loadMore: () => void;
}

interface LiveOpenThreads extends OpenThreads {
  readonly receiveThread: (parent: TopLevelMessage) => void;
}

type OpenThreadsClient = Pick<CookoutClient, "listOpenThreads">;

interface ScopeOptions {
  readonly client: OpenThreadsClient;
  readonly live: Live | null;
  readonly pageSize: number;
}

interface OpenThreadsOptions extends ScopeOptions {
  readonly all: boolean;
}

interface OpenThreadStores {
  readonly of: (all: boolean) => OpenThreads;
  readonly receiveThread: (parent: TopLevelMessage) => void;
}

interface Holder {
  readonly options: OpenThreadsOptions;
  readonly state: () => OpenThreadsState;
  readonly publish: (state: OpenThreadsState) => void;
  readonly track: (loading: Promise<void>) => void;
}

const IDLE: MoreState = { status: "idle" };
const NONE = 0;

function without(state: LoadedState, id: TopLevelMessage["id"]): LoadedState {
  return { ...state, threads: state.threads.filter((thread) => thread.message.id !== id) };
}

async function loadFirst(holder: Holder): Promise<void> {
  const { all, client, pageSize } = holder.options;
  try {
    const page = await client.listOpenThreads({ all, limit: pageSize });
    holder.publish({ cursor: page.cursor, more: IDLE, status: "loaded", threads: page.threads });
  } catch (error: unknown) {
    holder.publish({ ...refusalOf(error), status: "failed" });
  }
}

function reload(holder: Holder): void {
  holder.track(loadFirst(holder));
}

async function loadNext(holder: Holder, shown: LoadedState, cursor: string): Promise<void> {
  const { all, client, pageSize } = holder.options;
  holder.publish({ ...shown, more: { status: "loading" } });
  try {
    const page = await client.listOpenThreads({ all, cursor, limit: pageSize });
    const ids = new Set(shown.threads.map((thread) => thread.message.id));
    const added = page.threads.filter((thread) => !ids.has(thread.message.id));
    holder.publish({ cursor: page.cursor, more: IDLE, status: "loaded", threads: [...shown.threads, ...added] });
  } catch (error: unknown) {
    holder.publish({ ...shown, more: { ...refusalOf(error), status: "failed" } });
  }
}

function loadMore(holder: Holder): void {
  const state = holder.state();
  if (state.status === "loaded" && state.cursor !== null && state.more.status !== "loading") {
    holder.track(loadNext(holder, state, state.cursor));
  }
}

function moved(state: LoadedState, reply: Reply): LoadedState {
  const thread = state.threads.find((each) => each.message.id === reply.replyTo) ?? null;
  if (thread === null) {
    return state;
  }
  const rest = without(state, reply.replyTo);
  if (state.cursor !== null) {
    return rest;
  }
  const bumped = { lastActivityAt: reply.createdAt, message: withNewestReply({ parent: thread.message, reply }) };
  return { ...rest, threads: [...rest.threads, bumped] };
}

function receiveThread(holder: Holder, parent: TopLevelMessage): void {
  const state = holder.state();
  if (state.status !== "loaded") {
    return;
  }
  if (typeof parent.closedAt === "string") {
    holder.publish(without(state, parent.id));
    return;
  }
  if (!state.threads.some((thread) => thread.message.id === parent.id)) {
    reload(holder);
  }
}

function receive(holder: Holder, event: CookoutEvent): void {
  const state = holder.state();
  if (event.type === "thread") {
    receiveThread(holder, event.parent);
  }
  if (event.type === "message" && event.message.kind === "reply" && state.status === "loaded") {
    holder.publish(moved(state, event.message));
  }
}

function follow(holder: Holder): void {
  const { live } = holder.options;
  if (live === null) {
    return;
  }
  live.subscribe((event) => {
    receive(holder, event);
  });
  live.onBack(() => {
    reload(holder);
  });
}

function createOpenThreads(options: OpenThreadsOptions): LiveOpenThreads {
  const listeners = new Set<() => void>();
  let state: OpenThreadsState = { status: "loading" };
  let loading: Promise<void> | null = null;
  const holder: Holder = {
    options,
    publish: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    state: () => state,
    track: (next) => {
      loading = next;
    },
  };
  return {
    loadMore: () => {
      loadMore(holder);
    },
    receiveThread: (parent) => {
      receiveThread(holder, parent);
    },
    snapshot: () => state,
    subscribe: (listener) => {
      if (loading === null) {
        follow(holder);
      }
      if (listeners.size === NONE) {
        reload(holder);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function createOpenThreadStores(options: ScopeOptions): OpenThreadStores {
  const stores = new Map<boolean, LiveOpenThreads>();
  return {
    of: (all) => {
      const store = stores.get(all) ?? createOpenThreads({ ...options, all });
      stores.set(all, store);
      return store;
    },
    receiveThread: (parent) => {
      for (const store of stores.values()) {
        store.receiveThread(parent);
      }
    },
  };
}

export { type OpenThreads, type OpenThreadsClient, type OpenThreadsState, createOpenThreadStores };
