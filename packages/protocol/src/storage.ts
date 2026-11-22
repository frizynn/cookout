import { z } from "zod";

/**
 * Message IDs are one increasing sequence across the whole server. They are
 * the order of messages, the read-position markers and the SSE event IDs.
 */
export const messageIdSchema = z.number().int().positive();
export type MessageId = z.infer<typeof messageIdSchema>;

/**
 * Where the server keeps its data. It speaks in domain operations, never in
 * rows or queries. Each operation that must be atomic is one method, so each
 * adapter decides how to do the transaction.
 *
 * An adapter is opened by its own package (for example `openSqliteStorage`),
 * which also brings the store up to date (migrations). Every behaviour here
 * is covered by the contract suite in `@ai-hero/cookout-storage-tests`.
 */
export interface StorageAdapter {
  /** Takes the next message ID. Every call returns a larger ID than the last. */
  nextMessageId(): Promise<MessageId>;
  /** Resolves if the store can be used, rejects if not. Backs `GET /v1/health`. */
  checkHealth(): Promise<void>;
  /** Releases the store. Later calls reject. Closing twice is fine. */
  close(): Promise<void>;
}
