/**
 * The `board` store: what the web knows of the board, loaded through the SDK.
 * An external store, read by components with `useSyncExternalStore`; it loads
 * the channels once, when its first reader subscribes. `channel(name)` is that
 * channel's messages, its own store: when its first reader subscribes it loads
 * the newest page of top-level messages and acks the newest one, so viewing a
 * channel counts as reading it, and while a reader is subscribed it acks each
 * new top-level message that arrives live; each time it is opened again (a
 * first reader after none) it reloads the newest page, keeping older pages
 * loaded, and acks its newest message; `loadOlder` pages further back. `thread(channel, id)`
 * is the thread's parent and replies, its own store too: when its first reader
 * subscribes it loads the thread and acks its latest message, so opening a
 * thread counts as reading it, and while a reader is subscribed it acks each
 * new reply that arrives live; each time it is opened again it reloads the
 * thread and acks its latest message; `reply` posts a reply in that channel,
 * reloads the replies and only then calls `posted`, so a refused reply keeps
 * its text. `commands` is every registered command, loaded when its
 * first reader subscribes; a channel's `call` calls a command with data typed
 * as JSON, posting the call message in that channel, and keeps the schema
 * errors of data the command refuses; `editCallData` holds the data being
 * typed (`callData`), which only a successful call empties. With `live`, the board opens the live stream when any of
 * its stores is first read, and each new message on it joins the loaded
 * channel or thread it belongs to (a reply also counts in its top-level
 * message's replies), so messages from others appear without a reload; a message
 * in a channel the loaded list doesn't have reloads the list, so a channel
 * created since it loaded joins it. A refusal
 * keeps the server's error code; a server that can't be reached is `unreachable`.
 */
import type { ChannelMessages, LiveChannelMessages, MessagesClient } from "./lib/channel-messages.ts";
import type { Commands, CommandsClient } from "./lib/commands.ts";
import type { CookoutClient, MessageId } from "../sdk/index.ts";
import type { LiveThreadMessages, ThreadClient, ThreadMessages } from "./lib/thread-messages.ts";
import type { Live } from "../live/index.ts";
import type { Snapshot } from "./lib/channel-list.ts";
import { createChannelList } from "./lib/channel-list.ts";
import { createChannelMessages } from "./lib/channel-messages.ts";
import { createCommands } from "./lib/commands.ts";
import { createLiveFeed } from "./lib/live-feed.ts";
import { createThreadMessages } from "./lib/thread-messages.ts";

const PAGE_SIZE = 50;

function storeIn<Messages>(stores: Map<string, Messages>, key: string, make: () => Messages): Messages {
  const messages = stores.get(key) ?? make();
  stores.set(key, messages);
  return messages;
}

type BoardClient = Pick<CookoutClient, "listChannels"> & CommandsClient & MessagesClient & ThreadClient;

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
  const channels = new Map<string, LiveChannelMessages>();
  const threads = new Map<string, LiveThreadMessages>();
  const list = createChannelList(client);
  const { follow, followed } = createLiveFeed({
    live: options.live ?? null,
    receivers: () => [list, ...channels.values(), ...threads.values()],
  });
  return {
    channel: (name) =>
      storeIn(channels, name, () =>
        followed(createChannelMessages({ client, name, pageSize: options.pageSize ?? PAGE_SIZE })),
      ),
    commands: createCommands(client),
    snapshot: list.snapshot,
    subscribe: (listener) => {
      follow();
      return list.subscribe(listener);
    },
    thread: (channel, id) =>
      storeIn(threads, `${channel}/${String(id)}`, () => followed(createThreadMessages({ channel, client, id }))),
  };
}

export type { ChannelsState } from "./lib/channel-list.ts";
export type { ChannelMessages, ChannelMessagesState } from "./lib/channel-messages.ts";
export type { CallState } from "./lib/command-call.ts";
export type { SchemaProblem } from "../sdk/index.ts";
export type { Commands } from "./lib/commands.ts";
export type { ThreadMessages, ThreadMessagesState } from "./lib/thread-messages.ts";
