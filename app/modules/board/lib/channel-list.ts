import type { Channel, CookoutClient, Message } from "../../sdk/index.ts";
import type { Failure } from "./failure.ts";
import { failure } from "./failure.ts";

type ChannelsState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly channels: readonly Channel[] }
  | Failure;

interface Snapshot {
  readonly channels: ChannelsState;
}

interface ChannelList {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => Snapshot;
  readonly receive: (message: Message) => void;
  readonly add: (channel: Channel) => void;
}

type ListClient = Pick<CookoutClient, "listChannels">;

function isMissing(state: ChannelsState, message: Message): boolean {
  return state.status === "loaded" && !state.channels.some((channel) => channel.name === message.channel);
}

function withChannel(channels: readonly Channel[], added: Channel): readonly Channel[] {
  const others = channels.filter((channel) => channel.name !== added.name);
  return [...others, added].toSorted((first, second) => first.name.localeCompare(second.name));
}

function createChannelList(client: ListClient): ChannelList {
  const listeners = new Set<() => void>();
  let current: Snapshot = { channels: { status: "loading" } };
  let loading: Promise<void> | null = null;

  function publish(state: ChannelsState): void {
    current = { channels: state };
    for (const listener of listeners) {
      listener();
    }
  }

  async function load(): Promise<void> {
    try {
      const answer = await client.listChannels();
      publish({ channels: answer.channels, status: "loaded" });
    } catch (error: unknown) {
      publish(failure(error));
    }
  }

  async function reloadAfter(previous: Promise<void> | null): Promise<void> {
    await previous;
    await load();
  }

  return {
    add: (channel) => {
      if (current.channels.status === "loaded") {
        publish({ channels: withChannel(current.channels.channels, channel), status: "loaded" });
      }
    },
    receive: (message) => {
      if (isMissing(current.channels, message)) {
        loading = reloadAfter(loading);
      }
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
