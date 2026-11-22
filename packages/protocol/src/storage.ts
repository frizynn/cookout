import { z } from "zod";
import type { Identity } from "./identities.ts";

/**
 * Message IDs are one increasing sequence across the whole server. They are
 * the order of messages, the read-position markers and the SSE event IDs.
 */
export const messageIdSchema = z.number().int().positive();
export type MessageId = z.infer<typeof messageIdSchema>;

/**
 * What a token hash leads to. `revoked` is a token that was rotated away or
 * belonged to a deleted identity; `unknown` was never issued here.
 */
export type TokenLookup =
  | { status: "active"; identity: Identity }
  | { status: "revoked" }
  | { status: "unknown" };

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
  /**
   * Adds an identity with its first token hash. The store never sees the
   * token itself. Returns `name_taken` (and changes nothing) if the name is used.
   */
  createIdentity(identity: Identity, tokenHash: string): Promise<"created" | "name_taken">;
  /**
   * Adds the identity only if the store has no identities at all, in one step.
   * Returns whether it was added. Used on first boot to make the admin.
   */
  createIdentityIfNoneExist(identity: Identity, tokenHash: string): Promise<boolean>;
  /** Every identity, sorted by name. */
  listIdentities(): Promise<Identity[]>;
  /** The identity a token hash belongs to, or why there is none. */
  findIdentityByTokenHash(tokenHash: string): Promise<TokenLookup>;
  /**
   * Revokes the identity's current token and gives it `tokenHash` instead, in
   * one step. Returns the identity, or `undefined` if there is no such name.
   */
  replaceToken(name: string, tokenHash: string): Promise<Identity | undefined>;
  /**
   * Removes the identity and revokes its token. Returns what was removed, or
   * `undefined` if there is no such name.
   */
  deleteIdentity(name: string): Promise<Identity | undefined>;
  /** Resolves if the store can be used, rejects if not. Backs `GET /v1/health`. */
  checkHealth(): Promise<void>;
  /** Releases the store. Later calls reject. Closing twice is fine. */
  close(): Promise<void>;
}
