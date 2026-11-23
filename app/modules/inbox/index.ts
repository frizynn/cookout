/**
 * The inbox on the wire, shared by the server, the SDK and the web: what an
 * identity hasn't read yet and why each item is there, the ack that marks a
 * message and everything before it in its thread or channel as read, the
 * ack of the whole inbox up to the newest item the caller has seen, the
 * mark unread that moves a read position back to just before a message,
 * the inbox history of read and unread items, following a thread and
 * subscribing to a channel, and their paths. They
 * refuse with the message, channel and agent session error codes.
 */
import type { Channel, ChannelName } from "../channels/index.ts";
import type { Message, MessageId, TopLevelMessage } from "../messages/index.ts";

/**
 * Why an item is in the inbox: a reply in a thread the identity follows, a message that mentions it, or a top-level
 * message in a channel it subscribes to.
 */
export type InboxReason = "followed-thread" | "mention" | "subscribed-channel";

/** Every inbox reason, in the order an item lists them. */
export const inboxReasons: readonly InboxReason[] = ["followed-thread", "mention", "subscribed-channel"];

/** A message the identity hasn't read, with every reason it is there, its channel and its thread's top-level message. */
export interface InboxItem {
  readonly reasons: readonly InboxReason[];
  readonly channel: Channel;
  /** The thread's top-level message: the message itself when it is top-level. */
  readonly parent: TopLevelMessage;
  readonly message: Message;
}

/**
 * An identity's read position in one scope: a channel's top-level messages (`thread` is `null`) or one thread's
 * replies. Every message in the scope up to `messageId` is read.
 */
export interface ReadPosition {
  readonly channel: ChannelName;
  readonly thread: MessageId | null;
  readonly messageId: MessageId;
}

/** The inbox, oldest first, each message once. Reading it changes nothing. */
export interface InboxResponse {
  readonly items: readonly InboxItem[];
}

/** An item in the inbox history: `read` says the identity's read position for its scope is at or after it. */
export interface InboxHistoryItem extends InboxItem {
  readonly read: boolean;
}

/** The query of an inbox history page. With no `before`, the page is the newest items. */
export interface InboxHistoryQuery {
  /** Only items before this message ID: pass the last item's ID to read further back. */
  readonly before?: number;
  /** 1–200 items. Default 50. */
  readonly limit?: number;
}

/**
 * A page of the inbox history: every message in the inbox for at least one reason as things stand now, read or not,
 * newest first, each message once. `hasMore` says older items remain after the last. Reading it changes nothing.
 */
export interface InboxHistoryResponse {
  readonly items: readonly InboxHistoryItem[];
  readonly hasMore: boolean;
}

/** The caller's read positions: one for each channel and thread it has acked in or posted to, by channel name. */
export interface ReadPositionsResponse {
  readonly readPositions: readonly ReadPosition[];
}

/** The body of an ack. */
export interface AckRequest {
  readonly messageId: MessageId;
}

/** The answer to an ack: the read position of the message's scope, which never moves backwards. */
export interface AckResponse {
  readonly readPosition: ReadPosition;
}

/** The body of an ack of the whole inbox: every inbox item up to `upTo`, the newest the caller has seen, is read. */
export interface AckAllRequest {
  readonly upTo: MessageId;
}

/**
 * The answer to an ack of the whole inbox: the read positions it moved, oldest first. An item after `upTo` stays
 * unread.
 */
export interface AckAllResponse {
  readonly readPositions: readonly ReadPosition[];
}

/** The body of a mark unread: the message to make unread again, with everything after it in its thread or channel. */
export interface MarkUnreadRequest {
  readonly messageId: MessageId;
}

/**
 * A read position moved back by a mark unread: `messageId` is the newest message in the scope still read, `null` where
 * none is. In a thread with no reply left read it is the top-level message.
 */
export interface MovedBackReadPosition {
  readonly channel: ChannelName;
  readonly thread: MessageId | null;
  readonly messageId: MessageId | null;
}

/** The answer to a mark unread: the read position of the message's scope, which never moves forward. */
export interface MarkUnreadResponse {
  readonly readPosition: MovedBackReadPosition;
}

/** The answer to following or unfollowing: the thread, by its top-level message's ID. */
export interface FollowResponse {
  readonly thread: MessageId;
  readonly following: boolean;
}

/** The answer to subscribing or unsubscribing. */
export interface SubscriptionResponse {
  readonly channel: ChannelName;
  readonly subscribed: boolean;
}

/** `GET /v1/inbox`: the caller's inbox. */
export const inboxPath = "/v1/inbox";

/** `GET /v1/inbox/history?before=<id>&limit=<n>`: a page of the caller's inbox history, read and unread. */
export const inboxHistoryPath = "/v1/inbox/history";

/** `GET /v1/read-positions`: the caller's read positions. */
export const readPositionsPath = "/v1/read-positions";

/** `POST /v1/ack`: acks a message and everything before it in its thread or channel. */
export const ackPath = "/v1/ack";

/** `POST /v1/inbox/ack-all`: acks, as one change, every inbox item up to a message, in every thread and channel. */
export const ackAllPath = "/v1/inbox/ack-all";

/**
 * `POST /v1/read-positions/unread`: moves the read position of a message's thread or channel back to just before it, so
 * it and everything after it there is unread again.
 */
export const markUnreadPath = "/v1/read-positions/unread";

/** `PUT` follows and `DELETE` unfollows the thread holding the message. */
export const followPath = "/v1/messages/:id/follow";

/** `PUT` subscribes to and `DELETE` unsubscribes from the channel. */
export const subscriptionPath = "/v1/channels/:name/subscription";
