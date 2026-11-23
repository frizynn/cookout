/**
 * Live updates on the wire, shared by the server, the SDK and the web: the
 * events one Server-Sent Events stream sends (ADR 0002) and the stream's
 * path. Each event's SSE `event` field is its `type`, its SSE `id` is the
 * message ID, and its SSE `data` is the event as JSON. The stream starts
 * with one `connected` event, which isn't a `CookoutEvent`: the SDK reads it
 * for the caller. A stream that can't go on ends with one `refusal` event
 * instead.
 */
import type { Identity, IdentityName } from "../identities/index.ts";
import type { InboxItem, MovedBackReadPosition, ReadPosition, SubscriptionResponse } from "../inbox/index.ts";
import type { LiveConnectionId, Presence, presenceName } from "../presence/index.ts";
import type { Message, MessageId, ReadReceipt } from "../messages/index.ts";
import type { Channel } from "../channels/index.ts";
import type { Command } from "../commands/index.ts";

export type {
  LiveConnectionDetail,
  LiveConnectionId,
  OfflineReason,
  Presence,
  PresenceResponse,
} from "../presence/index.ts";

/** A new item in the caller's inbox, sent the moment another identity posts it. */
export interface InboxItemEvent {
  readonly type: "inbox-item";
  readonly item: InboxItem;
}

/** The caller's new read position in a thread or channel, sent the moment any session of the caller acks. */
export interface ReadPositionEvent {
  readonly type: "read-position";
  readonly readPosition: ReadPosition;
}

/**
 * The caller's read position in a thread or channel moved back, sent the moment any session of the caller marks a
 * message there unread: unlike `read-position`, it replaces the one before, though that was newer.
 */
export interface ReadPositionMovedBackEvent {
  readonly type: "read-position-moved-back";
  readonly readPosition: MovedBackReadPosition;
}

/** A new message on any channel, the caller's own included, sent only on the all-channels feed. */
export interface MessageEvent {
  readonly type: "message";
  readonly message: Message;
}

/**
 * An identity just created or changed (its display name, admin flag or owner, deactivating or reactivating it), as
 * the server now shows it, sent only on the all-channels feed so every open web UI shows it at once. Deactivating a
 * human sends one for it and one for each of its agents. It has no SSE `id`.
 */
export interface IdentityEvent {
  readonly type: "identity";
  readonly identity: Identity;
}

/**
 * A read receipt just recorded: one of a message's receipt identities has seen it for the first time. Sent only on
 * the all-channels feed, since everyone on the board sees receipts. It has no SSE `id`.
 */
export interface ReadReceiptEvent {
  readonly type: "read-receipt";
  readonly receipt: ReadReceipt;
}

/** A channel just created, sent only on the all-channels feed so every open web UI lists it at once. It has no SSE `id`. */
export interface ChannelEvent {
  readonly type: "channel";
  readonly channel: Channel;
}

/**
 * A channel just deleted, with everything in it, sent only on the all-channels feed so every open web UI drops it at
 * once. It has no SSE `id`.
 */
export interface ChannelDeletedEvent {
  readonly type: "channel-deleted";
  readonly channel: Channel;
}

/**
 * An identity an admin just deleted, as it was, sent only on the all-channels feed so every open web UI drops it from
 * its directory at once. It has no SSE `id`.
 */
export interface IdentityDeletedEvent {
  readonly type: "identity-deleted";
  readonly identity: Identity;
}

/**
 * A command just registered, or whose secret was just rotated, sent only on the all-channels feed so every open web
 * UI suggests it at once. It has no SSE `id`.
 */
export interface CommandEvent {
  readonly type: "command";
  readonly command: Command;
}

/**
 * An agent's agent session just changed: the agent joined or left, or its owner or an admin revoked its session.
 * Sent only on the all-channels feed of the agent's owner and of admins, the identities who may list its agent
 * sessions, so they list them again. It names the agent alone: the sessions stay behind that list. It has no SSE `id`.
 */
export interface AgentSessionEvent {
  readonly type: "agent-session";
  readonly agent: IdentityName;
}

/**
 * The caller's subscription to a channel just changed: any session of the caller subscribed or unsubscribed, or the
 * caller created the channel, which subscribes them. Sent on every stream of the caller, so its sessions stay in
 * sync. It has no SSE `id`.
 */
export interface SubscriptionEvent {
  readonly type: "subscription";
  readonly subscription: SubscriptionResponse;
}

/**
 * The stream's first word on connecting, before any item: the newest message ID on the board at that moment (null
 * before the first message). Every item the stream then sends live is newer, so a caller that resumes from this ID
 * after a drop misses nothing and repeats nothing. It has no SSE `id`. `connectionId` names this live connection, so
 * a `cookout watch` exiting on purpose can say so first with `DELETE /v1/events/:connection` (a clean close, ADR "how
 * a live connection ends"); a server from before clean closes sends none.
 */
export interface ConnectedEvent {
  readonly type: "connected";
  readonly latestMessageId: MessageId | null;
  readonly connectionId?: LiveConnectionId;
}

/** The answer to a clean close, `DELETE /v1/events/:connection`. */
export interface CleanCloseResponse {
  readonly closed: true;
}

/**
 * One identity's presence just changed (it came online, went offline, or connects another way), sent only on the
 * all-channels feed so every open web UI shows it at once. It has no SSE `id`, so a caller that reconnects reads
 * `GET /v1/presence` again.
 */
export interface PresenceEvent {
  readonly type: typeof presenceName;
  readonly presence: Presence;
}

/** Any event the stream sends. */
export type CookoutEvent =
  | InboxItemEvent
  | ReadPositionEvent
  | ReadPositionMovedBackEvent
  | MessageEvent
  | IdentityEvent
  | ReadReceiptEvent
  | ChannelEvent
  | ChannelDeletedEvent
  | IdentityDeletedEvent
  | CommandEvent
  | AgentSessionEvent
  | SubscriptionEvent
  | PresenceEvent;

/**
 * `GET /v1/events`: the caller's Server-Sent Events stream, one per connection. With `allChannelsQuery` as its query
 * it is also the all-channels feed: every new message on every channel.
 */
export const eventsPath = "/v1/events";

/** `DELETE /v1/events/:connection`: the clean close of the caller's live connection `connection`, answering `CleanCloseResponse`. */
export const liveConnectionPath = `${eventsPath}/:connection`;

/** The query that asks the stream for the all-channels feed: `?channels=all`. */
export const allChannelsQuery = { channels: "all" } as const;

/**
 * The SSE `event` of the stream's last event when it can't go on, such as `agent_session_revoked` once `leave` or
 * another session's `join --force` revokes the agent session token it was opened with: it has no `id`, and its
 * `data` is the refusal's `ErrorResponse` as JSON.
 */
export const refusalEvent = "refusal";
