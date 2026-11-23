import type { CookoutClient, MessageId, Refusal, TopLevelMessage } from "../../sdk/index.ts";
import { refusalOf } from "../../sdk/index.ts";
import { reopened } from "../../messages/index.ts";

type ClosingAction = "close" | "reopen";

type ClosingRefusal = Refusal & { readonly action: ClosingAction };

interface ThreadClosing {
  readonly subscribe: (listener: () => void) => () => void;
  readonly refusal: () => ClosingRefusal | null;
  readonly close: (messageId: MessageId) => void;
  readonly reopen: (messageId: MessageId) => void;
}

type ClosingClient = Pick<CookoutClient, "closeThread" | "reopenThread">;

interface ClosingOptions {
  readonly client: ClosingClient;
  readonly changed: (parent: TopLevelMessage) => void;
}

interface Asked {
  readonly action: ClosingAction;
  readonly messageId: MessageId;
}

interface Closed {
  readonly message: TopLevelMessage;
  readonly parent: TopLevelMessage;
}

function closedAs({ message, parent }: Closed): TopLevelMessage {
  if (message.id !== parent.id) {
    return message;
  }
  const { closedAt, closedBy } = parent;
  return { ...reopened(message), ...(closedAt && closedBy && { closedAt, closedBy }) };
}

async function after(previous: Promise<void> | null, step: () => Promise<void>): Promise<void> {
  await previous;
  await step();
}

function createThreadClosing({ changed, client }: ClosingOptions): ThreadClosing {
  const listeners = new Set<() => void>();
  const calls = { close: client.closeThread, reopen: client.reopenThread };
  let refused: ClosingRefusal | null = null;
  let queue: Promise<void> | null = null;

  function refuse(next: ClosingRefusal | null): void {
    refused = next;
    for (const listener of listeners) {
      listener();
    }
  }

  async function ask({ action, messageId }: Asked): Promise<void> {
    refuse(null);
    try {
      const { message } = await calls[action](messageId);
      changed(message);
    } catch (error: unknown) {
      refuse({ ...refusalOf(error), action });
    }
  }

  function enqueue(asked: Asked): void {
    queue = after(queue, async () => {
      await ask(asked);
    });
  }

  return {
    close: (messageId) => {
      enqueue({ action: "close", messageId });
    },
    refusal: () => refused,
    reopen: (messageId) => {
      enqueue({ action: "reopen", messageId });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type ClosingClient, type ThreadClosing, closedAs, createThreadClosing };
