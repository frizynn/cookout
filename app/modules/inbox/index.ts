/**
 * The inbox on the wire, shared by the server, the SDK and the web: what an
 * identity hasn't read yet and why each item is there, and the read position
 * an ack moves.
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
