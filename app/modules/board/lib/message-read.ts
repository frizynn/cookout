import type { CookoutClient, MessageId, ReadPosition } from "../../sdk/index.ts";
import type { Failure } from "./failure.ts";
import { failure } from "./failure.ts";

const NONE = 0;

type MessageReadState =
  | { readonly status: "acking" }
  | { readonly status: "acked"; readonly readPosition: ReadPosition }
  | Failure;

interface MessageRead {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => MessageReadState;
}

type ReadClient = Pick<CookoutClient, "ack">;

const ACKING: MessageReadState = { status: "acking" };

async function acked(client: ReadClient, id: MessageId): Promise<MessageReadState> {
  try {
    const { readPosition } = await client.ack(id);
    return { readPosition, status: "acked" };
  } catch (error: unknown) {
    return failure(error);
  }
}

function createMessageRead(client: ReadClient, id: MessageId): MessageRead {
  const listeners = new Set<() => void>();
  let state = ACKING;
  let acking: Promise<void> | null = null;

  async function ackAfter(previous: Promise<void> | null): Promise<void> {
    await previous;
    state = ACKING;
    state = await acked(client, id);
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    snapshot: () => state,
    subscribe: (listener) => {
      if (listeners.size === NONE) {
        acking = ackAfter(acking);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function createMessageReads(client: ReadClient): (id: MessageId) => MessageRead {
  const stores = new Map<MessageId, MessageRead>();
  return (id) => {
    const store = stores.get(id) ?? createMessageRead(client, id);
    stores.set(id, store);
    return store;
  };
}

export { type MessageRead, createMessageReads };
