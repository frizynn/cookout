import type { MessageId, StorageAdapter } from "@ai-hero/cookout-protocol";

/** A store that lives in this process only. Everything is lost on close. */
export function createMemoryStorage(): StorageAdapter {
  let lastMessageId = 0;
  let closed = false;

  function assertOpen(): void {
    if (closed) throw new Error("The in-memory store is closed.");
  }

  return {
    async nextMessageId(): Promise<MessageId> {
      assertOpen();
      lastMessageId += 1;
      return lastMessageId;
    },
    async checkHealth(): Promise<void> {
      assertOpen();
    },
    async close(): Promise<void> {
      closed = true;
    },
  };
}
