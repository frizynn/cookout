import type { ChannelName, CookoutClient, MessageId, ReadReceipt, TopLevelMessage } from "../../sdk/index.ts";
import type { Failure } from "./failure.ts";
import { failure } from "./failure.ts";

const ONE = 1;
const NONE = 0;

type MessageBeforeState =
  | { readonly status: "loading" }
  | {
      readonly status: "loaded";
      readonly message: TopLevelMessage | null;
      readonly receipts: readonly ReadReceipt[];
    }
  | Failure;

interface MessageBefore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => MessageBeforeState;
}

type BeforeClient = Pick<CookoutClient, "listMessages">;

interface At {
  readonly channel: ChannelName;
  readonly id: MessageId;
}

const LOADING: MessageBeforeState = { status: "loading" };

async function loadedBefore(client: BeforeClient, { channel, id }: At): Promise<MessageBeforeState> {
  try {
    const { messages, receipts } = await client.listMessages(channel, { before: id, limit: ONE });
    return { message: messages.at(NONE) ?? null, receipts, status: "loaded" };
  } catch (error: unknown) {
    return failure(error);
  }
}

function createMessageBefore(client: BeforeClient, at: At): MessageBefore {
  const listeners = new Set<() => void>();
  let state = LOADING;
  let loading: Promise<void> | null = null;

  async function load(): Promise<void> {
    state = await loadedBefore(client, at);
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      loading ??= load();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function createMessagesBefore(client: BeforeClient): (at: At) => MessageBefore {
  const stores = new Map<string, MessageBefore>();
  return (at) => {
    const key = `${at.channel}/${String(at.id)}`;
    const store = stores.get(key) ?? createMessageBefore(client, at);
    stores.set(key, store);
    return store;
  };
}

export { type MessageBefore, type MessageBeforeState, createMessagesBefore };
