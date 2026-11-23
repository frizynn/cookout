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
 * reloads the replies. `commands` is every registered command, loaded when its
 * first reader subscribes; a channel's `call` calls a command with data typed
 * as JSON, posting the call message in that channel, and keeps the schema
 * errors of data the command refuses. A refusal
 * keeps the server's error code; a server that can't be reached is `unreachable`.
 */
import type { Channel, CookoutClient, MessageId } from "../sdk/index.ts";
import type { ChannelMessages, MessagesClient } from "./lib/channel-messages.ts";
import type { Commands, CommandsClient } from "./lib/commands.ts";
import type { ThreadClient, ThreadMessages } from "./lib/thread-messages.ts";
import type { Failure } from "./lib/failure.ts";
import { createChannelMessages } from "./lib/channel-messages.ts";
import { createCommands } from "./lib/commands.ts";
import { createThreadMessages } from "./lib/thread-messages.ts";
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
  /** The thread holding the message in the channel: the same store each time for one channel and ID. */
  readonly thread: (channel: string, id: MessageId) => ThreadMessages;
  /** Every registered command, sorted by name: one store, loaded when its first reader subscribes. */
  readonly commands: Commands;
}

/** What the board store needs of the SDK. */
export type BoardClient = Pick<CookoutClient, "listChannels"> & CommandsClient & MessagesClient & ThreadClient;

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
  const threads = new Map<string, ThreadMessages>();
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
    commands: createCommands(client),
    snapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      loading ??= loadChannels();
      return () => {
        listeners.delete(listener);
      };
    },
    thread: (channel, id) => {
      const key = `${channel}/${String(id)}`;
      const messages = threads.get(key) ?? createThreadMessages({ channel, client, id });
      threads.set(key, messages);
      return messages;
    },
  };
}

export type { ChannelMessages, ChannelMessagesState } from "./lib/channel-messages.ts";
export type { CallState, SchemaProblem } from "./lib/command-call.ts";
export type { Commands, CommandsState } from "./lib/commands.ts";
export type { ThreadMessages, ThreadMessagesState } from "./lib/thread-messages.ts";
