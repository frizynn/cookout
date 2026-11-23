/**
 * The `board` store: what the web knows of the board, loaded through the SDK.
 * An external store, read by components with `useSyncExternalStore`; it loads
 * the channels once, when its first reader subscribes. `channel(name)` is that
 * channel's messages, its own store: when its first reader subscribes it loads
 * the newest page of top-level messages and acks the newest one, so viewing a
 * channel counts as reading it; `loadOlder` pages further back. A refusal
 * keeps the server's error code; a server that can't be reached is `unreachable`.
 */
import type { Channel, CookoutClient } from "../sdk/index.ts";
import type { ChannelMessages, MessagesClient } from "./lib/channel-messages.ts";
import type { Failure } from "./lib/failure.ts";
import { createChannelMessages } from "./lib/channel-messages.ts";
import { failure } from "./lib/failure.ts";

const PAGE_SIZE = 50;

interface Snapshot {
  readonly channels: ChannelsState;
}

/** The channel list, as far as it has loaded. */
export type ChannelsState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly channels: readonly Channel[] }
  | Failure;

/** The board store. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Board {
  /** Calls `listener` after every change, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The current snapshot: a new object whenever anything in it changes, the same one until then. */
  readonly snapshot: () => Snapshot;
  /** The named channel's messages: the same store each time for one name. */
  readonly channel: (name: string) => ChannelMessages;
}

/** What the board store needs of the SDK. */
export type BoardClient = Pick<CookoutClient, "listChannels"> & MessagesClient;

/** What the board is made with: an SDK client with the token of whoever is looking, and `pageSize` top-level messages a page, 50 unless given. */
export interface BoardOptions {
  readonly client: BoardClient;
  readonly pageSize?: number;
}

/**
 * Makes a board store that talks to the server through `options.client`.
 * @param options The client and how it pages.
 * @returns The store.
 */
export function createBoard(options: BoardOptions): Board {
  const { client } = options;
  const listeners = new Set<() => void>();
  const channels = new Map<string, ChannelMessages>();
  let current: Snapshot = { channels: { status: "loading" } };
  let loading: Promise<void> | null = null;

  function publish(state: ChannelsState): void {
    current = { ...current, channels: state };
    for (const listener of listeners) {
      listener();
    }
  }

  async function loadChannels(): Promise<void> {
    try {
      const answer = await client.listChannels();
      publish({ channels: answer.channels, status: "loaded" });
    } catch (error: unknown) {
      publish(failure(error));
    }
  }

  return {
    channel: (name) => {
      const messages =
        channels.get(name) ?? createChannelMessages({ client, name, pageSize: options.pageSize ?? PAGE_SIZE });
      channels.set(name, messages);
      return messages;
    },
    snapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      loading ??= loadChannels();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type { ChannelMessages, ChannelMessagesState } from "./lib/channel-messages.ts";
