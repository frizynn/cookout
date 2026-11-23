import type { CookoutClient, ReadPosition, TopLevelMessage } from "../../sdk/index.ts";
import type { Failure } from "./failure.ts";
import { failure } from "./failure.ts";

type OlderState = { readonly status: "idle" } | { readonly status: "loading" } | Failure;

type ReadState =
  | { readonly status: "none" }
  | { readonly status: "acking" }
  | { readonly status: "acked"; readonly readPosition: ReadPosition }
  | Failure;

interface Loaded {
  readonly status: "loaded";
  readonly messages: readonly TopLevelMessage[];
  readonly hasMore: boolean;
  readonly older: OlderState;
  readonly read: ReadState;
}

type ChannelMessagesState = { readonly status: "loading" } | Failure | Loaded;

interface ChannelMessages {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => ChannelMessagesState;
  readonly loadOlder: () => void;
}

type MessagesClient = Pick<CookoutClient, "ack" | "listMessages">;

interface Channel {
  readonly client: MessagesClient;
  readonly name: string;
  readonly pageSize: number;
  readonly current: () => ChannelMessagesState;
  readonly publish: (state: ChannelMessagesState) => void;
}

const NEWEST = -1;

function update(channel: Channel, change: (loaded: Loaded) => Loaded): void {
  const current = channel.current();
  if (current.status === "loaded") {
    channel.publish(change(current));
  }
}

async function ack(channel: Channel, message: TopLevelMessage): Promise<void> {
  update(channel, (loaded) => ({ ...loaded, read: { status: "acking" } }));
  try {
    const { readPosition } = await channel.client.ack(message.id);
    update(channel, (loaded) => ({ ...loaded, read: { readPosition, status: "acked" } }));
  } catch (error: unknown) {
    update(channel, (loaded) => ({ ...loaded, read: failure(error) }));
  }
}

async function loadNewest(channel: Channel): Promise<void> {
  try {
    const { hasMore, messages } = await channel.client.listMessages(channel.name, { limit: channel.pageSize });
    channel.publish({ hasMore, messages, older: { status: "idle" }, read: { status: "none" }, status: "loaded" });
    await Promise.all(
      messages.slice(NEWEST).map(async (newest) => {
        await ack(channel, newest);
      }),
    );
  } catch (error: unknown) {
    channel.publish(failure(error));
  }
}

async function loadOlderPage(channel: Channel): Promise<void> {
  const current = channel.current();
  if (current.status !== "loaded" || !current.hasMore) {
    return;
  }
  const before = Math.min(...current.messages.map((message) => message.id));
  update(channel, (loaded) => ({ ...loaded, older: { status: "loading" } }));
  try {
    const page = await channel.client.listMessages(channel.name, { before, limit: channel.pageSize });
    update(channel, (loaded) => ({
      ...loaded,
      hasMore: page.hasMore,
      messages: [...page.messages, ...loaded.messages],
      older: { status: "idle" },
    }));
  } catch (error: unknown) {
    update(channel, (loaded) => ({ ...loaded, older: failure(error) }));
  }
}

interface ChannelOptions {
  readonly client: MessagesClient;
  readonly name: string;
  readonly pageSize: number;
}

async function loadOlderAfter(previous: Promise<void>, channel: Channel): Promise<void> {
  await previous;
  await loadOlderPage(channel);
}

function createChannelMessages(options: ChannelOptions): ChannelMessages {
  const listeners = new Set<() => void>();
  let state: ChannelMessagesState = { status: "loading" };
  let queue: Promise<void> | null = null;
  const channel: Channel = {
    ...options,
    current: () => state,
    publish: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
  return {
    loadOlder: () => {
      queue = loadOlderAfter(queue ?? loadNewest(channel), channel);
    },
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      queue ??= loadNewest(channel);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type ChannelMessages, type ChannelMessagesState, type MessagesClient, createChannelMessages };
