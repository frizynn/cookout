import type { ChannelName, MessageId, TopLevelMessage } from "../../sdk/index.ts";
import type { ClosingClient, ThreadClosing } from "./thread-closing.ts";
import type { LiveChannelMessages, MessagesClient } from "./channel-messages.ts";
import type { LiveThreadMessages, ThreadClient } from "./thread-messages.ts";
import { createChannelMessages } from "./channel-messages.ts";
import { createThreadClosing } from "./thread-closing.ts";
import { createThreadMessages } from "./thread-messages.ts";

type Followed = <Store extends LiveChannelMessages | LiveThreadMessages>(store: Store) => Store;

interface MessageStores {
  readonly channel: (name: ChannelName, followed: Followed) => LiveChannelMessages;
  readonly thread: (
    at: { readonly channel: ChannelName; readonly id: MessageId },
    followed: Followed,
  ) => LiveThreadMessages;
  readonly loaded: () => readonly (LiveChannelMessages | LiveThreadMessages)[];
  readonly closing: ThreadClosing;
}

interface MessageStoresOptions {
  readonly client: ClosingClient & MessagesClient & ThreadClient;
  readonly pageSize: number;
  readonly closed: (parent: TopLevelMessage) => void;
}

function storeIn<Messages>(stores: Map<string, Messages>, key: string, make: () => Messages): Messages {
  const messages = stores.get(key) ?? make();
  stores.set(key, messages);
  return messages;
}

function createMessageStores({ client, closed, pageSize }: MessageStoresOptions): MessageStores {
  const channels = new Map<ChannelName, LiveChannelMessages>();
  const threads = new Map<string, LiveThreadMessages>();
  function loaded(): readonly (LiveChannelMessages | LiveThreadMessages)[] {
    return [...channels.values(), ...threads.values()];
  }
  return {
    channel: (name, followed) =>
      storeIn(channels, name, () => followed(createChannelMessages({ client, name, pageSize }))),
    closing: createThreadClosing({
      changed: (parent) => {
        for (const store of loaded()) {
          store.receiveThread(parent);
        }
        closed(parent);
      },
      client,
    }),
    loaded,
    thread: ({ channel, id }, followed) =>
      storeIn(threads, `${channel}/${String(id)}`, () => followed(createThreadMessages({ channel, client, id }))),
  };
}

type MessageStoresClient = MessageStoresOptions["client"];

export type { ChannelMessages } from "./channel-messages.ts";
export type { ThreadMessages } from "./thread-messages.ts";
export type { ThreadClosing } from "./thread-closing.ts";
export { type MessageStoresClient, createMessageStores };
