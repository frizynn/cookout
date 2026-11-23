import type { CookoutClient, MessageId, ReadPosition, Reply, TopLevelMessage } from "../../sdk/index.ts";
import type { Failure } from "./failure.ts";
import { failure } from "./failure.ts";

type ReadState =
  | { readonly status: "none" }
  | { readonly status: "acking" }
  | { readonly status: "acked"; readonly readPosition: ReadPosition }
  | Failure;

type ReplyState = { readonly status: "idle" } | { readonly status: "posting" } | Failure;

interface Loaded {
  readonly status: "loaded";
  readonly parent: TopLevelMessage;
  readonly replies: readonly Reply[];
  readonly read: ReadState;
  readonly reply: ReplyState;
}

type ThreadMessagesState = { readonly status: "loading" } | Failure | Loaded;

interface ThreadMessages {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => ThreadMessagesState;
  readonly reply: (text: string) => void;
}

type ThreadClient = Pick<CookoutClient, "ack" | "createMessage" | "getThread">;

interface Thread {
  readonly client: ThreadClient;
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

function latestOf(loaded: Loaded): MessageId {
  let latest = loaded.parent.id;
  for (const reply of loaded.replies) {
    latest = reply.id;
  }
  return latest;
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

function appended(loaded: Loaded, reply: Reply): Loaded {
  return { ...loaded, replies: [...loaded.replies, reply], reply: { status: "idle" } };
}

async function postReply(thread: Thread, text: string): Promise<void> {
  const current = thread.current();
  if (current.status !== "loaded" || current.reply.status === "posting") {
    return;
  }
  update(thread, (loaded) => ({ ...loaded, reply: { status: "posting" } }));
  try {
    const { message } = await thread.client.createMessage({
      channel: current.parent.channel,
      replyTo: current.parent.id,
      text,
    });
    update(thread, (loaded) => {
      if (message.kind === "reply") {
        return appended(loaded, message);
      }
      return { ...loaded, reply: { status: "idle" } };
    });
  } catch (error: unknown) {
    update(thread, (loaded) => ({ ...loaded, reply: failure(error) }));
  }
}

async function replyAfter(previous: Promise<void>, thread: Thread, text: string): Promise<void> {
  await previous;
  await postReply(thread, text);
}

interface ThreadOptions {
  readonly client: ThreadClient;
  readonly id: MessageId;
}

function createThreadMessages(options: ThreadOptions): ThreadMessages {
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
    reply: (text) => {
      queue = replyAfter(queue ?? load(thread), thread, text);
    },
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      queue ??= load(thread);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type ThreadClient, type ThreadMessages, type ThreadMessagesState, createThreadMessages };
