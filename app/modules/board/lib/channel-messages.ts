import type { ChannelName, CookoutClient, Message, ReadPosition, Reply, TopLevelMessage } from "../../sdk/index.ts";
import { callFailure, notJson, parseData } from "./command-call.ts";
import type { CallState } from "./command-call.ts";
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
  readonly call: CallState;
  readonly callData: string;
}

type ChannelMessagesState = { readonly status: "loading" } | Failure | Loaded;

interface ChannelMessages {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => ChannelMessagesState;
  readonly loadOlder: () => void;
  readonly call: (command: string, data: string) => void;
  readonly editCallData: (data: string) => void;
}

interface LiveChannelMessages extends ChannelMessages {
  readonly receive: (message: Message) => void;
}

type MessagesClient = Pick<CookoutClient, "ack" | "callCommand" | "listMessages">;

interface Channel {
  readonly client: MessagesClient;
  readonly name: ChannelName;
  readonly pageSize: number;
  readonly current: () => ChannelMessagesState;
  readonly publish: (state: ChannelMessagesState) => void;
}

const NEWEST = -1;
const ONE_MORE = 1;
const NONE_OPEN = 0;
const NONE_KEPT = 0;

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
    channel.publish({
      call: { status: "idle" },
      callData: "",
      hasMore,
      messages,
      older: { status: "idle" },
      read: { status: "none" },
      status: "loaded",
    });
    await Promise.all(
      messages.slice(NEWEST).map(async (newest) => {
        await ack(channel, newest);
      }),
    );
  } catch (error: unknown) {
    channel.publish(failure(error));
  }
}

interface Page {
  readonly hasMore: boolean;
  readonly messages: readonly TopLevelMessage[];
}

function withNewest(loaded: Loaded, page: Page): Loaded {
  const oldest = Math.min(...page.messages.map((message) => message.id));
  const kept = loaded.messages.filter((message) => message.id < oldest);
  if (kept.length === NONE_KEPT) {
    return { ...loaded, hasMore: page.hasMore, messages: page.messages };
  }
  return { ...loaded, messages: [...kept, ...page.messages] };
}

async function reloadNewest(channel: Channel): Promise<void> {
  if (channel.current().status !== "loaded") {
    await loadNewest(channel);
    return;
  }
  try {
    const page = await channel.client.listMessages(channel.name, { limit: channel.pageSize });
    update(channel, (loaded) => withNewest(loaded, page));
    await Promise.all(
      page.messages.slice(NEWEST).map(async (newest) => {
        await ack(channel, newest);
      }),
    );
  } catch (error: unknown) {
    update(channel, (loaded) => ({ ...loaded, read: failure(error) }));
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

async function addNewest(channel: Channel, command: string): Promise<void> {
  const page = await channel.client.listMessages(channel.name, { limit: channel.pageSize });
  update(channel, (loaded) => {
    const newest = Math.max(...loaded.messages.map((message) => message.id));
    const added = page.messages.filter((message) => message.id > newest);
    return { ...loaded, call: { command, status: "called" }, callData: "", messages: [...loaded.messages, ...added] };
  });
}

interface CallRequest {
  readonly command: string;
  readonly data: string;
}

async function callCommand(channel: Channel, request: CallRequest): Promise<void> {
  const { command } = request;
  const parsed = parseData(request.data);
  if (parsed.status === "not-json") {
    update(channel, (loaded) => ({ ...loaded, call: notJson(command) }));
    return;
  }
  update(channel, (loaded) => ({ ...loaded, call: { command, status: "calling" } }));
  try {
    await channel.client.callCommand(command, { channel: channel.name, data: parsed.data });
    await addNewest(channel, command);
  } catch (error: unknown) {
    update(channel, (loaded) => ({ ...loaded, call: callFailure({ command, error }) }));
  }
}

function withReply(parent: TopLevelMessage, reply: Reply): TopLevelMessage {
  if (parent.id !== reply.replyTo || (parent.latestReplyId !== null && parent.latestReplyId >= reply.id)) {
    return parent;
  }
  return { ...parent, latestReplyId: reply.id, replyCount: parent.replyCount + ONE_MORE };
}

function received(loaded: Loaded, message: Message): Loaded {
  if (message.kind === "reply") {
    return { ...loaded, messages: loaded.messages.map((parent) => withReply(parent, message)) };
  }
  if (loaded.messages.some((shown) => shown.id === message.id)) {
    return loaded;
  }
  return { ...loaded, messages: [...loaded.messages, message] };
}

interface ChannelOptions {
  readonly client: MessagesClient;
  readonly name: ChannelName;
  readonly pageSize: number;
}

async function callAfter(previous: Promise<void> | null, channel: Channel, request: CallRequest): Promise<void> {
  await previous;
  await callCommand(channel, request);
}

async function ackAfter(previous: Promise<void> | null, channel: Channel, message: TopLevelMessage): Promise<void> {
  await previous;
  await ack(channel, message);
}

async function reloadAfter(previous: Promise<void> | null, channel: Channel): Promise<void> {
  await previous;
  await reloadNewest(channel);
}

async function loadOlderAfter(previous: Promise<void> | null, channel: Channel): Promise<void> {
  await previous;
  await loadOlderPage(channel);
}

function createChannelMessages(options: ChannelOptions): LiveChannelMessages {
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
    call: (command, data) => {
      queue = callAfter(queue, channel, { command, data });
    },
    editCallData: (data) => {
      update(channel, (loaded) => ({ ...loaded, callData: data }));
    },
    loadOlder: () => {
      queue = loadOlderAfter(queue, channel);
    },
    receive: (message) => {
      if (message.channel !== options.name) {
        return;
      }
      const before = state;
      update(channel, (loaded) => received(loaded, message));
      if (message.kind === "top-level" && state !== before && listeners.size > NONE_OPEN) {
        queue = ackAfter(queue, channel, message);
      }
    },
    snapshot: () => state,
    subscribe: (listener) => {
      if (listeners.size === NONE_OPEN && queue !== null) {
        queue = reloadAfter(queue, channel);
      }
      listeners.add(listener);
      queue ??= loadNewest(channel);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export {
  type ChannelMessages,
  type ChannelMessagesState,
  type LiveChannelMessages,
  type MessagesClient,
  createChannelMessages,
};
