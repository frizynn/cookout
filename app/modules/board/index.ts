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
 * first reader subscribes (`createCommands` makes such a store alone); a channel's `call` calls a command with data typed
 * as JSON, posting the call message in that channel, and keeps the schema
 * errors of data the command refuses; `editCallData` holds the data being
 * typed (`callData`), which only a successful call empties, and only then
 * is `called` called, so a refused call keeps everything typed. A channel's `post`
 * posts a top-level message there, adds it to the loaded messages and only
 * then calls `posted`, so a refused post keeps its text; the server counts it
 * read for its poster. With `live`, the board opens the live stream when any of
 * its stores is first read, and each new message on it joins the loaded
 * channel or thread it belongs to (a reply also counts in its top-level
 * message's replies), so messages from others appear without a reload; a message
 * in a channel the loaded list doesn't have reloads the list, and each channel
 * created elsewhere joins the loaded list at once, as the stream announces it; each
 * one deleted elsewhere leaves it, and if the page is on it, the page goes to the
 * inbox with its name as the snapshot's `notice` until `dismissNotice`; and each
 * command registered elsewhere joins the loaded `commands`. `subscriptions` is the names of the channels
 * the logged-in identity subscribes to, sorted, loaded when its first reader
 * subscribes; `setSubscribed` subscribes to a channel or unsubscribes from it,
 * keeping the refusal, with the channel, if the server refuses. With `live`, a subscribe or unsubscribe from
 * another session of the identity reaches it at once. `creation`
 * is the new channel form: whether it is open and what is typed in it;
 * `create` creates the channel as `cookout channel create` does, which subscribes
 * the creator, adds it to the loaded list and the subscriptions, empties and closes the form and only then calls `created`,
 * so a refused name keeps what was typed, with the refusal on the field it
 * concerns (the description's own schema errors; anything else, the name). A refusal
 * keeps the server's error code; a server that can't be reached is `unreachable`.
 */
import type { ChannelMessages, LiveChannelMessages, MessagesClient } from "./lib/channel-messages.ts";
import type { ChannelName, CookoutClient, MessageId } from "../sdk/index.ts";
import type { Commands, CommandsClient } from "./lib/commands.ts";
import type { LiveThreadMessages, ThreadClient, ThreadMessages } from "./lib/thread-messages.ts";
import type { Subscriptions, SubscriptionsClient } from "./lib/subscriptions.ts";
import type { ChannelCreation } from "./lib/channel-creation.ts";
import type { Live } from "../live/index.ts";
import type { Snapshot } from "./lib/channel-list.ts";
import { createChannelCreation } from "./lib/channel-creation.ts";
import { createChannelList } from "./lib/channel-list.ts";
import { createChannelMessages } from "./lib/channel-messages.ts";
import { createCommands } from "./lib/commands.ts";
import { createLiveFeed } from "./lib/live-feed.ts";
import { createSubscriptions } from "./lib/subscriptions.ts";
import { createThreadMessages } from "./lib/thread-messages.ts";

const PAGE_SIZE = 50;

function storeIn<Messages>(stores: Map<string, Messages>, key: string, make: () => Messages): Messages {
  const messages = stores.get(key) ?? make();
  stores.set(key, messages);
  return messages;
}

type BoardClient = Pick<CookoutClient, "createChannel" | "listChannels"> &
  CommandsClient &
  MessagesClient &
  SubscriptionsClient &
  ThreadClient;

/** The board store. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Board {
  /** Calls `listener` after every change, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The current snapshot: a new object whenever anything in it changes, the same one until then. */
  readonly snapshot: () => Snapshot;
  /** The named channel's messages: the same store each time for one name. */
  readonly channel: (name: ChannelName) => ChannelMessages;
  /** The thread holding the message in the channel: the same store each time for one channel and ID. */
  readonly thread: (channel: ChannelName, id: MessageId) => ThreadMessages;
  /** Every registered command, sorted by name: one store, loaded when its first reader subscribes. */
  readonly commands: Commands;
  /** The channels the logged-in identity subscribes to: one store, loaded when its first reader subscribes. */
  readonly subscriptions: Subscriptions;
  /** The new channel form: one store, whose channels join the loaded list. */
  readonly creation: ChannelCreation;
  /** Empties the snapshot's `notice`. */
  readonly dismissNotice: () => void;
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
  const channels = new Map<ChannelName, LiveChannelMessages>();
  const threads = new Map<string, LiveThreadMessages>();
  const list = createChannelList(client);
  const { heard, subscriptions } = createSubscriptions({ client, live: options.live ?? null });
  const { follow, followed } = createLiveFeed({
    added: list.add,
    deleted: list.remove,
    live: options.live ?? null,
    receivers: () => [list, ...channels.values(), ...threads.values()],
  });
  return {
    channel: (name) =>
      storeIn(channels, name, () =>
        followed(createChannelMessages({ client, name, pageSize: options.pageSize ?? PAGE_SIZE })),
      ),
    commands: createCommands(options),
    creation: createChannelCreation({
      client,
      put: (channel) => {
        list.add(channel);
        heard({ channel: channel.name, subscribed: true });
      },
    }),
    dismissNotice: list.dismissNotice,
    snapshot: list.snapshot,
    subscribe: (listener) => {
      follow();
      return list.subscribe(listener);
    },
    subscriptions,
    thread: (channel, id) =>
      storeIn(threads, `${channel}/${String(id)}`, () => followed(createThreadMessages({ channel, client, id }))),
  };
}

export type { ChannelCreation, ChannelCreationSnapshot, CreationState } from "./lib/channel-creation.ts";
export type { ChannelsState } from "./lib/channel-list.ts";
export type { ChannelMessages, ChannelMessagesState } from "./lib/channel-messages.ts";
export type { CallState } from "./lib/command-call.ts";
export type { SchemaProblem } from "../sdk/index.ts";
export type { Commands } from "./lib/commands.ts";
export { createCommands } from "./lib/commands.ts";
export type { PostState } from "./lib/failure.ts";
export type { Subscriptions, SubscriptionsState } from "./lib/subscriptions.ts";
export type { ThreadMessages, ThreadMessagesState } from "./lib/thread-messages.ts";
