import type { Channel, ChannelMessagesState, LiveChannelMessages, Loaded, MessagesClient } from "./channel-state.ts";
import type { ChannelName, Message, MessageId, ReadReceipt, Reply, TopLevelMessage } from "../../sdk/index.ts";
import { callFailure, notJson, parseData } from "./command-call.ts";
import { withHeard, withReceipts } from "./receipts.ts";
import type { CallRequest } from "./command-call.ts";
import { closedAs } from "./thread-closing.ts";
import { failure } from "./failure.ts";
import { withNewestReply } from "../../messages/index.ts";

const NEWEST = -1;
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
    const { hasMore, messages, receipts } = await channel.client.listMessages(channel.name, {
      limit: channel.pageSize,
    });
    channel.publish({
      call: { status: "idle" },
      callData: "",
      expanded: new Map(),
      hasMore,
      messages,
      older: { status: "idle" },
      post: { status: "idle" },
      read: { status: "none" },
      receipts,
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
  readonly receipts: readonly ReadReceipt[];
}

function withNewest(loaded: Loaded, page: Page): Loaded {
  const oldest = Math.min(...page.messages.map((message) => message.id));
  const kept = loaded.messages.filter((message) => message.id < oldest);
  const receipts = withReceipts({ fresh: page.receipts, receipts: loaded.receipts });
  if (kept.length === NONE_KEPT) {
    return { ...loaded, hasMore: page.hasMore, messages: page.messages, receipts };
  }
  return { ...loaded, messages: [...kept, ...page.messages], receipts };
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
      receipts: withReceipts({ fresh: page.receipts, receipts: loaded.receipts }),
    }));
  } catch (error: unknown) {
    update(channel, (loaded) => ({ ...loaded, older: failure(error) }));
  }
}

async function addNewest(channel: Channel, { called, command }: CallRequest): Promise<void> {
  const page = await channel.client.listMessages(channel.name, { limit: channel.pageSize });
  update(channel, (loaded) => {
    const newest = Math.max(...loaded.messages.map((message) => message.id));
    const added = page.messages.filter((message) => message.id > newest);
    return {
      ...loaded,
      call: { command, status: "called" },
      callData: "",
      messages: [...loaded.messages, ...added],
      receipts: withReceipts({ fresh: page.receipts, receipts: loaded.receipts }),
    };
  });
  called();
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
    await addNewest(channel, request);
  } catch (error: unknown) {
    update(channel, (loaded) => ({ ...loaded, call: callFailure({ command, error }) }));
  }
}

function withReply(parent: TopLevelMessage, reply: Reply): TopLevelMessage {
  if (parent.id !== reply.replyTo || (parent.latestReplyId !== null && parent.latestReplyId >= reply.id)) {
    return parent;
  }
  return withNewestReply({ parent, reply });
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

function holds(loaded: Loaded, id: MessageId): boolean {
  return loaded.messages.some((message) => message.id === id);
}

interface PostRequest {
  readonly text: string;
  readonly posted: () => void;
}

async function postMessage(channel: Channel, { posted, text }: PostRequest): Promise<void> {
  update(channel, (loaded) => ({ ...loaded, post: { status: "posting" } }));
  try {
    const { message } = await channel.client.createMessage({ channel: channel.name, text });
    update(channel, (loaded) => ({ ...received(loaded, message), post: { status: "idle" } }));
    posted();
  } catch (error: unknown) {
    update(channel, (loaded) => ({ ...loaded, post: failure(error) }));
  }
}

interface ShownClosed {
  readonly run: readonly MessageId[];
  readonly count: number;
}

function withShown(loaded: Loaded, { count, run }: ShownClosed): Loaded {
  const expanded = new Map(loaded.expanded);
  for (const id of run) {
    expanded.set(id, count);
  }
  return { ...loaded, expanded };
}

interface ChannelOptions {
  readonly client: MessagesClient;
  readonly name: ChannelName;
  readonly pageSize: number;
}

async function after(previous: Promise<void> | null, step: () => Promise<void>): Promise<void> {
  await previous;
  await step();
}

type Enqueue = <Request>(step: (channel: Channel, request: Request) => Promise<void>, request: Request) => void;

type LiveMethods = Pick<LiveChannelMessages, "receive" | "receiveReceipt" | "receiveThread" | "refetch">;

function liveMethods(channel: Channel, enqueue: Enqueue): LiveMethods {
  return {
    receive: (message) => {
      if (message.channel !== channel.name) {
        return;
      }
      const before = channel.current();
      update(channel, (loaded) => received(loaded, message));
      if (message.kind === "top-level" && channel.current() !== before && channel.open()) {
        enqueue(ack, message);
      }
    },
    receiveReceipt: (receipt) => {
      update(channel, (loaded) => ({
        ...loaded,
        receipts: withHeard({ holds: (id) => holds(loaded, id), receipt, receipts: loaded.receipts }),
      }));
    },
    receiveThread: (parent) => {
      update(channel, (loaded) => ({
        ...loaded,
        messages: loaded.messages.map((message) => closedAs({ message, parent })),
      }));
    },
    refetch: () => {
      if (channel.open()) {
        enqueue(reloadNewest, null);
      }
    },
  };
}

function createChannelMessages(options: ChannelOptions): LiveChannelMessages {
  const listeners = new Set<() => void>();
  let state: ChannelMessagesState = { status: "loading" };
  let queue: Promise<void> | null = null;
  const channel: Channel = {
    ...options,
    current: () => state,
    open: () => listeners.size > NONE_OPEN,
    publish: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
  function enqueue<Request>(step: (on: Channel, request: Request) => Promise<void>, request: Request): void {
    queue = after(queue, async () => {
      await step(channel, request);
    });
  }
  return {
    ...liveMethods(channel, enqueue),
    call: (command, data, called) => {
      enqueue(callCommand, { called, command, data });
    },
    editCallData: (data) => {
      update(channel, (loaded) => ({ ...loaded, callData: data }));
    },
    loadOlder: () => {
      enqueue(loadOlderPage, null);
    },
    post: (text, posted) => {
      enqueue(postMessage, { posted, text });
    },
    showClosed: (run, count) => {
      update(channel, (loaded) => withShown(loaded, { count, run }));
    },
    snapshot: () => state,
    subscribe: (listener) => {
      if (!channel.open() && queue !== null) {
        enqueue(reloadNewest, null);
      }
      listeners.add(listener);
      queue ??= loadNewest(channel);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type { ChannelMessages, ChannelMessagesState, LiveChannelMessages, MessagesClient } from "./channel-state.ts";
export { createChannelMessages };
