/**
 * The `board` store: what the web knows of the board, loaded through the SDK.
 * An external store, read by components with `useSyncExternalStore`; it loads
 * the channels once, when its first reader subscribes. `channel(name)` is that
 * channel's messages, its own store: when its first reader subscribes it loads
 * the newest page of top-level messages and acks the newest one, so viewing a
 * channel counts as reading it; `loadOlder` pages further back. `thread(channel, id)`
 * is the thread's parent and replies, its own store too: when its first reader
 * subscribes it loads the thread and acks its latest message, so opening a
 * thread counts as reading it; `reply` posts a reply in that channel and
 * reloads the replies. With `live`, the board opens the live stream when any of
 * its stores is first read, and each new message on it joins the loaded
 * channel or thread it belongs to (a reply also counts in its top-level
 * message's replies), so messages from others appear without a reload. A refusal
 * keeps the server's error code; a server that can't be reached is `unreachable`.
 */
import type { Channel, CookoutClient, MessageId } from "../sdk/index.ts";
import type { ChannelMessages, LiveChannelMessages, MessagesClient } from "./lib/channel-messages.ts";
import type { LiveThreadMessages, ThreadClient, ThreadMessages } from "./lib/thread-messages.ts";
import type { Failure } from "./lib/failure.ts";
import type { Live } from "../live/index.ts";
import { createChannelMessages } from "./lib/channel-messages.ts";
import { createLiveFeed } from "./lib/live-feed.ts";
import { createThreadMessages } from "./lib/thread-messages.ts";
import { failure } from "./lib/failure.ts";

const PAGE_SIZE = 50;

interface Snapshot {
  readonly channels: ChannelsState;
}

function storeIn<Messages>(stores: Map<string, Messages>, key: string, make: () => Messages): Messages {
  const messages = stores.get(key) ?? make();
  stores.set(key, messages);
  return messages;
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
  /** The thread holding the message in the channel: the same store each time for one channel and ID. */
  readonly thread: (channel: string, id: MessageId) => ThreadMessages;
}

/** What the board store needs of the SDK. */
export type BoardClient = Pick<CookoutClient, "listChannels"> & MessagesClient & ThreadClient;

/**
 * What the board is made with: an SDK client with the token of whoever is looking, `pageSize` top-level messages a
 * page (50 unless given), and the live stream to follow, if any.
 */
export interface BoardOptions {
  readonly client: BoardClient;
  readonly pageSize?: number;
  readonly live?: Live;
}

/**
 * Makes a board store that talks to the server through `options.client`.
 * @param options The client, how it pages, and the live stream.
 * @returns The store.
 */
export function createBoard(options: BoardOptions): Board {
  const { client } = options;
  const listeners = new Set<() => void>();
  const channels = new Map<string, LiveChannelMessages>();
  const threads = new Map<string, LiveThreadMessages>();
  let current: Snapshot = { channels: { status: "loading" } };
  let loading: Promise<void> | null = null;
  const { follow, followed } = createLiveFeed({
    live: options.live ?? null,
    receivers: () => [...channels.values(), ...threads.values()],
  });

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
    channel: (name) =>
      storeIn(channels, name, () =>
        followed(createChannelMessages({ client, name, pageSize: options.pageSize ?? PAGE_SIZE })),
      ),
    snapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      follow();
      loading ??= loadChannels();
      return () => {
        listeners.delete(listener);
      };
    },
    thread: (channel, id) =>
      storeIn(threads, `${channel}/${String(id)}`, () => followed(createThreadMessages({ channel, client, id }))),
  };
}

export type { ChannelMessages, ChannelMessagesState } from "./lib/channel-messages.ts";
export type { ThreadMessages, ThreadMessagesState } from "./lib/thread-messages.ts";
