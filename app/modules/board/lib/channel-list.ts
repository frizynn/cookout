import type { Channel, ChannelName, CookoutClient, Message } from "../../sdk/index.ts";
import { hrefOf, locationOf } from "../../paths/index.ts";
import type { Failure } from "./failure.ts";
import { failure } from "./failure.ts";

type ChannelsState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly channels: readonly Channel[] }
  | Failure;

interface Snapshot {
  readonly channels: ChannelsState;
  readonly notice: ChannelName | null;
}

interface ChannelList {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => Snapshot;
  readonly receive: (message: Message) => void;
  readonly add: (channel: Channel) => void;
  readonly remove: (channel: Channel) => void;
  readonly dismissNotice: () => void;
  readonly reload: () => void;
}

type ListClient = Pick<CookoutClient, "listChannels">;

function isMissing(state: ChannelsState, message: Message): boolean {
  return state.status === "loaded" && !state.channels.some((channel) => channel.name === message.channel);
}

function withChannel(state: ChannelsState, added: Channel): ChannelsState {
  if (state.status !== "loaded") {
    return state;
  }
  const others = state.channels.filter((channel) => channel.name !== added.name);
  const channels = [...others, added].toSorted((first, second) => first.name.localeCompare(second.name));
  return { channels, status: "loaded" };
}

function withoutChannel(state: ChannelsState, name: ChannelName): ChannelsState {
  if (state.status !== "loaded") {
    return state;
  }
  return { channels: state.channels.filter((channel) => channel.name !== name), status: "loaded" };
}

function leftIfOpen(name: ChannelName): boolean {
  const { route } = locationOf(globalThis.location.hash);
  if ((route.name === "channel" || route.name === "thread") && route.channel === name) {
    globalThis.location.hash = hrefOf({ name: "inbox", selected: null });
    return true;
  }
  return false;
}

async function listedBy(client: ListClient): Promise<ChannelsState> {
  try {
    const answer = await client.listChannels();
    return { channels: answer.channels, status: "loaded" };
  } catch (error: unknown) {
    return failure(error);
  }
}

function createChannelList(client: ListClient): ChannelList {
  const listeners = new Set<() => void>();
  let current: Snapshot = { channels: { status: "loading" }, notice: null };
  let loading: Promise<void> | null = null;

  function change(next: Partial<Snapshot>): void {
    current = { ...current, ...next };
    for (const listener of listeners) {
      listener();
    }
  }

  async function load(): Promise<void> {
    change({ channels: await listedBy(client) });
  }

  async function reloadAfter(previous: Promise<void> | null): Promise<void> {
    await previous;
    await load();
  }

  return {
    add: (channel) => {
      change({ channels: withChannel(current.channels, channel) });
    },
    dismissNotice: () => {
      change({ notice: null });
    },
    receive: (message) => {
      if (isMissing(current.channels, message)) {
        loading = reloadAfter(loading);
      }
    },
    reload: () => {
      loading = reloadAfter(loading);
    },
    remove: ({ name }) => {
      const channels = withoutChannel(current.channels, name);
      change({ channels, ...(leftIfOpen(name) && { notice: name }) });
    },
    snapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      loading ??= load();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type ChannelsState, type Snapshot, createChannelList };
