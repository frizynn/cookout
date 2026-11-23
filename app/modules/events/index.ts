/**
 * Live updates on the wire, shared by the server, the SDK and the web: the
 * events one Server-Sent Events stream sends (ADR 0002) and the stream's
 * path. Each event's SSE `event` field is its `type`, its SSE `id` is the
 * message ID, and its SSE `data` is the event as JSON. The stream starts
 * with one `connected` event, which isn't a `CookoutEvent`: the SDK reads it
 * for the caller. A stream that can't go on ends with one `refusal` event
 * instead.
 */
import type { InboxItem, ReadPosition, SubscriptionResponse } from "../inbox/index.ts";
import type { Message, MessageId } from "../messages/index.ts";
import type { Channel } from "../channels/index.ts";
import type { Identity } from "../identities/index.ts";

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

/** A channel just created, sent only on the all-channels feed so every open web UI lists it at once. It has no SSE `id`. */
export interface ChannelEvent {
  readonly type: "channel";
  readonly channel: Channel;
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
 * after a drop misses nothing and repeats nothing. It has no SSE `id`.
 */
export interface ConnectedEvent {
  readonly type: "connected";
  readonly latestMessageId: MessageId | null;
}

/** Any event the stream sends. */
export type CookoutEvent =
  | InboxItemEvent
  | ReadPositionEvent
  | MessageEvent
  | IdentityEvent
  | ChannelEvent
  | SubscriptionEvent;

/**
 * `GET /v1/events`: the caller's Server-Sent Events stream, one per connection. With `allChannelsQuery` as its query
 * it is also the all-channels feed: every new message on every channel.
 */
export const eventsPath = "/v1/events";

/** The query that asks the stream for the all-channels feed: `?channels=all`. */
export const allChannelsQuery = { channels: "all" } as const;

/**
 * The SSE `event` of the stream's last event when it can't go on, such as `agent_session_revoked` once `leave` or
 * another session's `join --force` revokes the agent session token it was opened with: it has no `id`, and its
 * `data` is the refusal's `ErrorResponse` as JSON.
 */
export const refusalEvent = "refusal";
