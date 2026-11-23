/**
 * The inbox on the wire, shared by the server, the SDK and the web: what an
 * identity hasn't read yet and why each item is there, the ack that marks a
 * message and everything before it in its thread or channel as read,
 * following a thread and subscribing to a channel, and their paths. They
 * refuse with the message, channel and lease error codes.
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

/** The body of an ack. */
export interface AckRequest {
  readonly messageId: MessageId;
}

/** The answer to an ack: the read position of the message's scope, which never moves backwards. */
export interface AckResponse {
  readonly readPosition: ReadPosition;
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

/** `POST /v1/ack`: acks a message and everything before it in its thread or channel. */
export const ackPath = "/v1/ack";

/** `PUT` follows and `DELETE` unfollows the thread holding the message. */
export const followPath = "/v1/messages/:id/follow";

/** `PUT` subscribes to and `DELETE` unsubscribes from the channel. */
export const subscriptionPath = "/v1/channels/:name/subscription";
