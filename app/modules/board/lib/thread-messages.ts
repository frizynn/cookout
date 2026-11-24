import type {
  ChannelName,
  CookoutClient,
  Message,
  MessageId,
  ReadPosition,
  ReadReceipt,
  Reply,
  TopLevelMessage,
} from "../../sdk/index.ts";
import type { Failure, PostState } from "./failure.ts";
import { withHeard, withReceipts } from "./receipts.ts";
import { closedAs } from "./thread-closing.ts";
import { createThreadReaders } from "./thread-readers.ts";
import { failure } from "./failure.ts";
import { withNewestReply } from "../../messages/index.ts";

type ReadState =
  | { readonly status: "none" }
  | { readonly status: "acking" }
  | { readonly status: "acked"; readonly readPosition: ReadPosition }
  | Failure;

interface Loaded {
  readonly status: "loaded";
  readonly parent: TopLevelMessage;
  readonly replies: readonly Reply[];
  readonly receipts: readonly ReadReceipt[];
  readonly read: ReadState;
  readonly reply: PostState;
}

type ThreadMessagesState = { readonly status: "loading" } | Failure | Loaded;

interface ThreadMessages {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => ThreadMessagesState;
  readonly reply: (text: string, posted: () => void) => void;
  readonly subscribeWithoutAcking: (listener: () => void) => () => void;
  readonly ack: (id: MessageId) => void;
}

interface LiveThreadMessages extends ThreadMessages {
  readonly receive: (message: Message) => void;
  readonly receiveReceipt: (receipt: ReadReceipt) => void;
  readonly receiveThread: (parent: TopLevelMessage) => void;
  readonly refetch: () => void;
}

type ThreadClient = Pick<CookoutClient, "ack" | "createMessage" | "getThread">;

interface Thread {
  readonly client: ThreadClient;
  readonly channel: ChannelName;
  readonly id: MessageId;
  readonly current: () => ThreadMessagesState;
  readonly publish: (state: ThreadMessagesState) => void;
  readonly acking: () => boolean;
}

function update(thread: Thread, change: (loaded: Loaded) => Loaded): void {
  const current = thread.current();
  if (current.status === "loaded") {
    thread.publish(change(current));
  }
}

function latestOf(loaded: Pick<Loaded, "parent" | "replies">): MessageId {
  let latest = loaded.parent.id;
  for (const reply of loaded.replies) {
    latest = reply.id;
  }
  return latest;
}

function received(loaded: Loaded, message: Message): Loaded {
  if (
    message.kind !== "reply" ||
    message.replyTo !== loaded.parent.id ||
    loaded.replies.some((reply) => reply.id === message.id)
  ) {
    return loaded;
  }
  return {
    ...loaded,
    parent: withNewestReply({ parent: loaded.parent, reply: message }),
    replies: [...loaded.replies, message],
  };
}

async function ack(thread: Thread, id: MessageId): Promise<void> {
  update(thread, (loaded) => ({ ...loaded, read: { status: "acking" } }));
  try {
    const { readPosition } = await thread.client.ack(id);
    update(thread, (loaded) => ({ ...loaded, read: { readPosition, status: "acked" } }));
  } catch (error: unknown) {
    update(thread, (loaded) => ({ ...loaded, read: failure(error) }));
  }
}

async function ackIfAcking(thread: Thread, id: MessageId): Promise<void> {
  if (thread.acking()) {
    await ack(thread, id);
  }
}

async function load(thread: Thread): Promise<void> {
  try {
    const { parent, receipts, replies } = await thread.client.getThread(thread.id);
    const loaded: Loaded = {
      parent,
      read: { status: "none" },
      receipts,
      replies,
      reply: { status: "idle" },
      status: "loaded",
    };
    thread.publish(loaded);
    await ackIfAcking(thread, latestOf(loaded));
  } catch (error: unknown) {
    thread.publish(failure(error));
  }
}

async function reload(thread: Thread): Promise<void> {
  if (thread.current().status !== "loaded") {
    await load(thread);
    return;
  }
  try {
    const { parent, receipts, replies } = await thread.client.getThread(thread.id);
    update(thread, (loaded) => ({
      ...loaded,
      parent,
      receipts: withReceipts({ fresh: receipts, receipts: loaded.receipts }),
      replies,
    }));
    await ackIfAcking(thread, latestOf({ parent, replies }));
  } catch (error: unknown) {
    update(thread, (loaded) => ({ ...loaded, read: failure(error) }));
  }
}

interface ReplyRequest {
  readonly text: string;
  readonly posted: () => void;
}

async function postReply(thread: Thread, { posted, text }: ReplyRequest): Promise<void> {
  update(thread, (loaded) => ({ ...loaded, reply: { status: "posting" } }));
  try {
    await thread.client.createMessage({ channel: thread.channel, replyTo: thread.id, text });
    const { parent, receipts, replies } = await thread.client.getThread(thread.id);
    update(thread, (loaded) => ({
      ...loaded,
      parent,
      receipts: withReceipts({ fresh: receipts, receipts: loaded.receipts }),
      replies,
      reply: { status: "idle" },
    }));
    posted();
  } catch (error: unknown) {
    update(thread, (loaded) => ({ ...loaded, reply: failure(error) }));
  }
}

function holds(loaded: Loaded, id: MessageId): boolean {
  return loaded.parent.id === id || loaded.replies.some((reply) => reply.id === id);
}

async function ackAfter(previous: Promise<void> | null, thread: Thread, id: MessageId): Promise<void> {
  await previous;
  await ack(thread, id);
}

async function reloadAfter(previous: Promise<void> | null, thread: Thread): Promise<void> {
  await previous;
  await reload(thread);
}

async function replyAfter(previous: Promise<void> | null, thread: Thread, request: ReplyRequest): Promise<void> {
  await previous;
  await postReply(thread, request);
}

function heardMethods(thread: Thread): Pick<LiveThreadMessages, "receiveReceipt" | "receiveThread"> {
  return {
    receiveReceipt: (receipt) => {
      update(thread, (loaded) => ({
        ...loaded,
        receipts: withHeard({ holds: (id) => holds(loaded, id), receipt, receipts: loaded.receipts }),
      }));
    },
    receiveThread: (parent) => {
      update(thread, (loaded) => ({ ...loaded, parent: closedAs({ message: loaded.parent, parent }) }));
    },
  };
}

interface ThreadOptions {
  readonly client: ThreadClient;
  readonly channel: ChannelName;
  readonly id: MessageId;
}

function createThreadMessages(options: ThreadOptions): LiveThreadMessages {
  const readers = createThreadReaders();
  let state: ThreadMessagesState = { status: "loading" };
  let queue: Promise<void> | null = null;
  const thread: Thread = {
    ...options,
    acking: readers.ackingSinceAsked,
    current: () => state,
    publish: (next) => {
      state = next;
      readers.notify();
    },
  };
  function listen(listener: () => void, acking: boolean): () => void {
    if (!readers.any() && queue !== null) {
      queue = reloadAfter(queue, thread);
    }
    readers.add(listener, acking);
    queue ??= load(thread);
    return () => {
      readers.remove(listener);
    };
  }
  return {
    ...heardMethods(thread),
    ack: (id) => {
      queue = ackAfter(queue, thread, id);
    },
    receive: (message) => {
      const before = state;
      update(thread, (loaded) => received(loaded, message));
      if (state !== before && readers.acking()) {
        queue = ackAfter(queue, thread, message.id);
      }
    },
    refetch: () => {
      if (readers.any()) {
        queue = reloadAfter(queue, thread);
      }
    },
    reply: (text, posted) => {
      queue = replyAfter(queue, thread, { posted, text });
    },
    snapshot: () => state,
    subscribe: (listener) => listen(listener, true),
    subscribeWithoutAcking: (listener) => listen(listener, false),
  };
}

export {
  type LiveThreadMessages,
  type ThreadClient,
  type ThreadMessages,
  type ThreadMessagesState,
  createThreadMessages,
};
