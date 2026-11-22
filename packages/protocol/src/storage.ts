import type { Channel } from "./channels.ts";
import type { Identity, IdentityName } from "./identities.ts";
import type { ListMessagesResponse, Message, MessageId, ThreadResponse } from "./messages.ts";

/** A message to append: everything but its ID and reply counts, which the store sets. */
export type NewMessage = Omit<Message, "id" | "replyTo" | "replyCount" | "latestReplyId"> & {
  /** The message replied to. The store moves a reply to a reply onto the top-level message. */
  replyTo?: MessageId;
};

/** What `appendMessage` did. Every refusal stores nothing and takes no ID. */
export type AppendMessageResult =
  | { status: "appended"; message: Message }
  | { status: "channel_not_found" }
  | { status: "reply_to_not_found" }
  | { status: "reply_in_other_channel" };

/** A page of a channel's top-level messages (see `listChannelMessages`). */
export type ChannelPage = ListMessagesResponse;

/** A top-level message and its replies in order. */
export type Thread = ThreadResponse;

/**
 * What a token hash leads to. `revoked` is a token that was rotated away or
 * belonged to a deleted identity; `unknown` was never issued here.
 */
export type TokenLookup =
  | { status: "active"; identity: Identity }
  | { status: "revoked" }
  | { status: "unknown" };

/** What `deleteIdentity` did. */
export type DeleteIdentityResult =
  | { status: "deleted"; identity: Identity }
  | { status: "not_found" }
  | { status: "last_admin" };

/** An identity's lease as the store keeps it. Times are ISO 8601 UTC. */
export type StoredLease = { identity: IdentityName; leaseId: string; expiresAt: string };

/**
 * A lease is live while `now` is before its `expiresAt`; from `expiresAt` on
 * it has ended, and the store treats the identity as not held.
 */
export type TakeLeaseRequest = {
  identity: IdentityName;
  /** The new lease ID, made by the server's injected ID source. */
  leaseId: string;
  now: string;
  expiresAt: string;
  /** Takes the lease even if another live lease holds the identity. */
  force: boolean;
};

/** What `takeLease` did. `held` changed nothing. */
export type TakeLeaseResult = { status: "taken"; lease: StoredLease } | { status: "held"; heldUntil: string };

/**
 * What `renewLease` and `releaseLease` did. `lost` (the lease ID is not the
 * identity's live lease) changed nothing; `heldUntil` is when the live lease
 * ends, or `null` if nobody holds the identity.
 */
export type RenewLeaseResult = { status: "renewed"; lease: StoredLease } | { status: "lost"; heldUntil: string | null };
export type ReleaseLeaseResult = { status: "released" } | { status: "lost"; heldUntil: string | null };

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
   * Removes the identity and revokes its token, in one step. Refuses (and
   * changes nothing) if it is the last admin, so a cookout always has one.
   */
  deleteIdentity(name: string): Promise<DeleteIdentityResult>;
  /** Adds a channel. Returns `name_taken` (and changes nothing) if the name is used. */
  createChannel(channel: Channel): Promise<"created" | "name_taken">;
  /** Every channel, sorted by name. */
  listChannels(): Promise<Channel[]>;
  /** The channel with this name, or `undefined`. */
  findChannel(name: string): Promise<Channel | undefined>;
  /**
   * Checks the channel and the message replied to, takes the next message ID
   * and stores the message, in one step. A reply to a reply is stored with
   * `replyTo` set to the top-level message. Later tickets add mentions and
   * follows to this same step.
   */
  appendMessage(message: NewMessage): Promise<AppendMessageResult>;
  /**
   * Up to `limit` of the channel's newest top-level messages with IDs below
   * `before` (all, if absent), oldest first, with reply counts. `undefined`
   * if there is no such channel.
   */
  listChannelMessages(channel: string, page: { before?: MessageId; limit: number }): Promise<ChannelPage | undefined>;
  /** The thread holding the message (top-level or reply), or `undefined` if there is no such message. */
  getThread(messageId: MessageId): Promise<Thread | undefined>;
  /**
   * Gives the identity a new lease, in one step, unless another live lease
   * holds it and `force` is false. Taking over replaces the old lease ID,
   * which stops working at once.
   */
  takeLease(request: TakeLeaseRequest): Promise<TakeLeaseResult>;
  /** Moves the lease's `expiresAt` to the one given, only if `leaseId` is the identity's live lease at `now`. In one step. */
  renewLease(request: { identity: IdentityName; leaseId: string; now: string; expiresAt: string }): Promise<RenewLeaseResult>;
  /** Ends the lease, only if `leaseId` is the identity's live lease at `now`. In one step. */
  releaseLease(request: { identity: IdentityName; leaseId: string; now: string }): Promise<ReleaseLeaseResult>;
  /** The identity's live lease at `now`, or `undefined`. Deleting an identity drops its lease. */
  findLease(identity: IdentityName, now: string): Promise<StoredLease | undefined>;
  /** Resolves if the store can be used, rejects if not. Backs `GET /v1/health`. */
  checkHealth(): Promise<void>;
  /** Releases the store. Later calls reject. Closing twice is fine. */
  close(): Promise<void>;
}
