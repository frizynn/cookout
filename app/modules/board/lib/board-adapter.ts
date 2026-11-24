import type { ChannelMessagesState, MessageBeforeState, ThreadMessagesState } from "./message-selectors.ts";
import type { ChannelName, MessageId } from "../../sdk/index.ts";
import type { ChannelsState, CommandsState } from "./listed-slices.ts";
import {
  channelList,
  channelPage,
  closingRefusal,
  commandList,
  deletedChannelNotice,
  messageBeforeOf,
  subscribedChannels,
  threadOf,
} from "./board-selectors.ts";
import type { BoardStore } from "./board-store.ts";
import type { ChannelCreation } from "./channel-creation.ts";
import type { ClosingRefusal } from "./thread-closing.ts";
import type { SubscriptionsState } from "./subscriptions-slice.ts";
import type { ThreadPlace } from "./threads-part.ts";
import { createChannelCreation } from "./channel-creation.ts";

type Subscribe = (listener: () => void) => () => void;

const NONE = 0;

interface Snapshot {
  readonly channels: ChannelsState;
  readonly notice: ChannelName | null;
}

interface ChannelMessages {
  readonly subscribe: Subscribe;
  readonly snapshot: () => ChannelMessagesState;
  readonly loadOlder: () => void;
  readonly call: (command: string, data: string, called: () => void) => void;
  readonly editCallData: (data: string) => void;
  readonly post: (text: string, posted: () => void) => void;
  readonly showClosed: (run: readonly MessageId[], count: number) => void;
}

interface ThreadMessages {
  readonly subscribe: Subscribe;
  readonly snapshot: () => ThreadMessagesState;
  readonly reply: (text: string, posted: () => void) => void;
  readonly subscribeWithoutAcking: Subscribe;
  readonly ack: (id: MessageId) => void;
}

interface Commands {
  readonly subscribe: Subscribe;
  readonly snapshot: () => CommandsState;
}

interface Subscriptions {
  readonly subscribe: Subscribe;
  readonly snapshot: () => SubscriptionsState;
  readonly setSubscribed: (channel: ChannelName, subscribed: boolean) => void;
}

interface ThreadClosing {
  readonly subscribe: Subscribe;
  readonly refusal: () => ClosingRefusal | null;
  readonly close: (messageId: MessageId) => void;
  readonly reopen: (messageId: MessageId) => void;
}

interface MessageBefore {
  readonly subscribe: Subscribe;
  readonly snapshot: () => MessageBeforeState;
}

interface Board {
  readonly subscribe: Subscribe;
  readonly snapshot: () => Snapshot;
  readonly channel: (name: ChannelName) => ChannelMessages;
  readonly thread: (channel: ChannelName, id: MessageId) => ThreadMessages;
  readonly commands: Commands;
  readonly subscriptions: Subscriptions;
  readonly creation: ChannelCreation;
  readonly closing: ThreadClosing;
  readonly messageBefore: (at: ThreadPlace) => MessageBefore;
  readonly ack: (id: MessageId) => void;
  readonly dismissNotice: () => void;
}

function madeOnce<Key, Made>(keyOf: (key: Key) => string, make: (key: Key) => Made): (key: Key) => Made {
  const made = new Map<string, Made>();
  return (key) => {
    const found = made.get(keyOf(key)) ?? make(key);
    made.set(keyOf(key), found);
    return found;
  };
}

function placeKey({ channel, id }: ThreadPlace): string {
  return `${channel}/${String(id)}`;
}

function listSnapshot(store: BoardStore): () => Snapshot {
  const last: Snapshot[] = [];
  return () => {
    const state = store.snapshot();
    const channels = channelList(state);
    const notice = deletedChannelNotice(state);
    const found = last.find((each) => each.channels === channels && each.notice === notice) ?? { channels, notice };
    last.splice(NONE, last.length, found);
    return found;
  };
}

function channelOf(store: BoardStore, name: ChannelName): ChannelMessages {
  const select = channelPage(name);
  const pages = store.channelPages;
  return {
    call: (command, data, called) => {
      pages.call(name, { called, command, data });
    },
    editCallData: (data) => {
      pages.editCallData(name, data);
    },
    loadOlder: () => {
      pages.loadOlder(name);
    },
    post: (text, posted) => {
      pages.post(name, { posted, text });
    },
    showClosed: (run, count) => {
      pages.showClosed(name, { count, run });
    },
    snapshot: () => select(store.snapshot()),
    subscribe: pages.subscribeShowing(name),
  };
}

function threadIn(store: BoardStore, place: ThreadPlace): ThreadMessages {
  const select = threadOf(place);
  const { threads } = store;
  return {
    ack: (id) => {
      threads.ack(place, id);
    },
    reply: (text, posted) => {
      threads.reply(place, { posted, text });
    },
    snapshot: () => select(store.snapshot()),
    subscribe: threads.subscribeShowing(place, true),
    subscribeWithoutAcking: threads.subscribeShowing(place, false),
  };
}

function beforeIn(store: BoardStore, place: ThreadPlace): MessageBefore {
  const select = messageBeforeOf(place);
  return { snapshot: () => select(store.snapshot()), subscribe: store.subscribeShowingBefore(place) };
}

function createBoard(store: BoardStore): Board {
  const channels = madeOnce(String, (name: ChannelName) => channelOf(store, name));
  const threads = madeOnce(placeKey, (place: ThreadPlace) => threadIn(store, place));
  return {
    ack: store.calls.ack,
    channel: channels,
    closing: {
      close: store.calls.close,
      refusal: () => closingRefusal(store.snapshot()),
      reopen: store.calls.reopen,
      subscribe: store.subscribe,
    },
    commands: {
      snapshot: () => commandList(store.snapshot()),
      subscribe: store.subscribeShowing("commands"),
    },
    creation: createChannelCreation({ createChannel: store.calls.createChannel }),
    dismissNotice: store.dismissNotice,
    messageBefore: madeOnce(placeKey, (place: ThreadPlace) => beforeIn(store, place)),
    snapshot: listSnapshot(store),
    subscribe: store.subscribeShowing("channels"),
    subscriptions: {
      setSubscribed: store.calls.setSubscribed,
      snapshot: () => subscribedChannels(store.snapshot()),
      subscribe: store.subscribeShowing("subscriptions"),
    },
    thread: (channel, id) => threads({ channel, id }),
  };
}

export {
  type Board,
  type ChannelMessages,
  type Commands,
  type MessageBefore,
  type Snapshot,
  type Subscriptions,
  type ThreadClosing,
  type ThreadMessages,
  createBoard,
};
