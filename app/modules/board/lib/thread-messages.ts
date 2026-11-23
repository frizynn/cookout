import type {
  ChannelName,
  CookoutClient,
  Message,
  MessageId,
  ReadPosition,
  Reply,
  TopLevelMessage,
} from "../../sdk/index.ts";
import type { Failure, PostState } from "./failure.ts";
import { failure } from "./failure.ts";

type ReadState =
  | { readonly status: "none" }
  | { readonly status: "acking" }
  | { readonly status: "acked"; readonly readPosition: ReadPosition }
  | Failure;

interface Loaded {
  readonly status: "loaded";
  readonly parent: TopLevelMessage;
  readonly replies: readonly Reply[];
  readonly read: ReadState;
  readonly reply: PostState;
}

type ThreadMessagesState = { readonly status: "loading" } | Failure | Loaded;

interface ThreadMessages {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => ThreadMessagesState;
  readonly reply: (text: string, posted: () => void) => void;
}

interface LiveThreadMessages extends ThreadMessages {
  readonly receive: (message: Message) => void;
}

type ThreadClient = Pick<CookoutClient, "ack" | "createMessage" | "getThread">;

const NONE_OPEN = 0;

interface Thread {
  readonly client: ThreadClient;
  readonly channel: ChannelName;
  readonly id: MessageId;
  readonly current: () => ThreadMessagesState;
  readonly publish: (state: ThreadMessagesState) => void;
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
  return { ...loaded, replies: [...loaded.replies, message] };
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

async function load(thread: Thread): Promise<void> {
  try {
    const { parent, replies } = await thread.client.getThread(thread.id);
    const loaded: Loaded = { parent, read: { status: "none" }, replies, reply: { status: "idle" }, status: "loaded" };
    thread.publish(loaded);
    await ack(thread, latestOf(loaded));
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
    const { parent, replies } = await thread.client.getThread(thread.id);
    update(thread, (loaded) => ({ ...loaded, parent, replies }));
    await ack(thread, latestOf({ parent, replies }));
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
    const { replies } = await thread.client.getThread(thread.id);
    update(thread, (loaded) => ({ ...loaded, replies, reply: { status: "idle" } }));
    posted();
  } catch (error: unknown) {
    update(thread, (loaded) => ({ ...loaded, reply: failure(error) }));
  }
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

interface ThreadOptions {
  readonly client: ThreadClient;
  readonly channel: ChannelName;
  readonly id: MessageId;
}

function createThreadMessages(options: ThreadOptions): LiveThreadMessages {
  const listeners = new Set<() => void>();
  let state: ThreadMessagesState = { status: "loading" };
  let queue: Promise<void> | null = null;
  const thread: Thread = {
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
    receive: (message) => {
      const before = state;
      update(thread, (loaded) => received(loaded, message));
      if (state !== before && listeners.size > NONE_OPEN) {
        queue = ackAfter(queue, thread, message.id);
      }
    },
    reply: (text, posted) => {
      queue = replyAfter(queue, thread, { posted, text });
    },
    snapshot: () => state,
    subscribe: (listener) => {
      if (listeners.size === NONE_OPEN && queue !== null) {
        queue = reloadAfter(queue, thread);
      }
      listeners.add(listener);
      queue ??= load(thread);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export {
  type LiveThreadMessages,
  type ThreadClient,
  type ThreadMessages,
  type ThreadMessagesState,
  createThreadMessages,
};
