/**
 * The inbox on the wire, shared by the server, the SDK and the web: what an
 * identity hasn't read yet and why each item is there, the ack that marks a
 * message and everything before it in its thread or channel as read, the
 * ack of the whole inbox up to the newest item the caller has seen, the
 * mark unread that moves a read position back to just before a message,
 * the inbox history of read and unread items, following a thread and
 * subscribing to a channel, the offline alerts an owner's inbox holds beside its items and marking one read, Nudges
 * about quiet threads, and their paths. They refuse with the message, channel, nudge and agent session error codes.
 */
import type { Channel, ChannelName } from "../channels/index.ts";
import type { Message, MessageId, Reaction, TopLevelMessage } from "../messages/index.ts";
import type { OfflineAlert, OfflineAlertId } from "../presence/index.ts";
import type { IsoTime } from "../time/index.ts";

declare const brand: unique symbol;

const LOWEST_ID = 1;

/** A nudge's ID: a positive whole number, increasing in the order nudges are raised. */
export type NudgeId = number & { readonly [brand]: "NudgeId" };

/**
 * Whether `value` is a positive whole number; if so, it is a `NudgeId`.
 * @param value The number to check.
 * @returns Whether `value` is a `NudgeId`.
 */
export function isNudgeId(value: number): value is NudgeId {
  return Number.isSafeInteger(value) && value >= LOWEST_ID;
}

/** Which nudge of a quiet spell: the first, after `nudgeIntervals.first`, or the second, `nudgeIntervals.second` later. */
export type NudgeKind = "first" | "second";

/** Both nudge kinds, in the order they are raised. */
export const nudgeKinds: readonly NudgeKind[] = ["first", "second"];

/**
 * How long an open thread stays quiet before each nudge, in days: the first comes this long after the thread's last
 * activity, the second this long after the first. Fixed for now (mattpocock/cookout#211 makes them a setting).
 */
export const nudgeIntervals = { first: 3, second: 7 } as const satisfies Readonly<Record<NudgeKind, number>>;

/** What each nudge says, spelled once here. */
export const nudgeTexts: Readonly<Record<NudgeKind, string>> = {
  first: `Quiet for ${String(nudgeIntervals.first)} days: close it, or follow up?`,
  second: `Quiet for ${String(nudgeIntervals.first + nudgeIntervals.second)} days: close it, or follow up?`,
};

/**
 * A Nudge: a reminder in the Inbox of a thread's starter that the open thread has been quiet for a while. It is not
 * a message, so it moves no read position. It turns read when the thread is closed or gets a new message, when its
 * recipient marks it read, or with an ack of the whole inbox.
 */
export interface Nudge {
  readonly id: NudgeId;
  readonly kind: NudgeKind;
  /** What the nudge says: "Quiet for 3 days: close it, or follow up?" for the first. */
  readonly text: string;
  readonly raisedAt: IsoTime;
  readonly channel: Channel;
  /** The quiet thread's top-level message, as it now stands. */
  readonly parent: TopLevelMessage;
}

/** A nudge in the inbox history: `read` says it has been read. */
export interface InboxHistoryNudge extends Nudge {
  readonly read: boolean;
}

/** The answer to marking a nudge read: the nudge, now read. */
export interface NudgeResponse {
  readonly nudge: InboxHistoryNudge;
}

/**
 * `POST /v1/inbox/nudges/:id/read`: marks one of the caller's nudges read, answering `NudgeResponse`. Another identity's
 * nudge, or one that doesn't exist, is 404 `nudge_not_found`.
 */
export const nudgeReadPath = "/v1/inbox/nudges/:id/read";

/** The codes the nudge routes refuse with: a nudge that isn't the caller's or doesn't exist. */
export const nudgeErrorCodes = ["nudge_not_found"] as const;

/**
 * Why an item is in the inbox: a reply in a thread the identity follows, a message that mentions it, another
 * identity's reaction on the identity's own message, or a top-level message in a channel it subscribes to.
 */
export type InboxReason = "followed-thread" | "mention" | "reaction" | "subscribed-channel";

/** Every inbox reason, in the order an item lists them. */
export const inboxReasons: readonly InboxReason[] = ["followed-thread", "mention", "reaction", "subscribed-channel"];

/** A message the identity hasn't read, with every reason it is there, its channel and its thread's top-level message. */
export interface InboxItem {
  readonly reasons: readonly InboxReason[];
  readonly channel: Channel;
  /** The thread's top-level message: the message itself when it is top-level. */
  readonly parent: TopLevelMessage;
  readonly message: Message;
  /**
   * For the `reaction` reason, the reactions on the identity's own message that it hasn't acked yet, oldest first, each
   * shown as "@name reacted with 👍". In the inbox history, every other identity's reaction on it, acked or not. Absent
   * for an item there for no reaction.
   */
  readonly newReactions?: readonly Reaction[];
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

/**
 * The inbox, oldest first, each message once, and beside it the caller's unread offline alerts, oldest first (always
 * none for an agent, which owns no agent), and its unread Nudges, oldest first. Reading it changes nothing.
 */
export interface InboxResponse {
  readonly items: readonly InboxItem[];
  readonly alerts: readonly OfflineAlert[];
  readonly nudges: readonly Nudge[];
}

/**
 * An item in the inbox history: `read` says the identity's read position for its scope is at or after it, or, for a
 * reaction item (the identity's own message), that it has acked every reaction on it.
 */
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
 * newest first, each message once. `hasMore` says older items remain after the last. The first page (no `before`)
 * also lists every offline alert raised for the caller, read or not, newest first; a later page lists none. Reading it
 * changes nothing.
 */
export interface InboxHistoryResponse {
  readonly items: readonly InboxHistoryItem[];
  readonly alerts: readonly OfflineAlert[];
  readonly hasMore: boolean;
  /** Every Nudge the caller has had, read or not, newest first, on the newest page (with no `before`) only. */
  readonly nudges: readonly InboxHistoryNudge[];
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

/**
 * The body of an ack of the whole inbox: every inbox item up to `upTo`, the newest the caller has seen, is read, and
 * every offline alert up to `alertsUpTo`, the newest alert it has seen, and every Nudge up to `nudgesUpTo`, the
 * newest nudge it has seen. Any may be left out.
 */
export interface AckAllRequest {
  readonly upTo?: MessageId;
  readonly alertsUpTo?: OfflineAlertId;
  readonly nudgesUpTo?: NudgeId;
}

/**
 * The answer to an ack of the whole inbox: the read positions it moved, oldest first, and the offline alerts it
 * marked read, oldest first. An item after `upTo`, or an alert after `alertsUpTo`, stays unread.
 */
export interface AckAllResponse {
  readonly readPositions: readonly ReadPosition[];
  readonly alerts: readonly OfflineAlert[];
}

/** The answer to marking one offline alert read: the alert, now read. */
export interface OfflineAlertResponse {
  readonly alert: OfflineAlert;
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

/** The SDK's call on an offline alert. */
export interface OfflineAlertCalls {
  /**
   * `POST /v1/inbox/alerts/:id/read`: marks the caller's offline alert read, so it leaves the inbox and stays in its
   * history. An alert the caller has none of is 404 `offline_alert_not_found`.
   */
  readonly markOfflineAlertRead: (id: OfflineAlertId) => Promise<OfflineAlertResponse>;
}

/** `POST /v1/inbox/alerts/:id/read`: marks the caller's offline alert `id` read (404 `offline_alert_not_found` otherwise). */
export const offlineAlertReadPath = "/v1/inbox/alerts/:id/read";

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

export type { OfflineAlert, OfflineAlertId } from "../presence/index.ts";
