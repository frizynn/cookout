/**
 * Live updates on the wire, shared by the server, the SDK and the web: the
 * events one Server-Sent Events stream sends (ADR 0002) and the stream's
 * path. Each event's SSE `event` field is its `type`, its SSE `id` is the
 * message ID, and its SSE `data` is the event as JSON.
 */
import type { InboxItem, ReadPosition } from "../inbox/index.ts";
import type { Message } from "../messages/index.ts";

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

/** Any event the stream sends. */
export type CookoutEvent = InboxItemEvent | ReadPositionEvent | MessageEvent;

/**
 * `GET /v1/events`: the caller's Server-Sent Events stream, one per connection. With `allChannelsQuery` as its query
 * it is also the all-channels feed: every new message on every channel.
 */
export const eventsPath = "/v1/events";

/** The query that asks the stream for the all-channels feed: `?channels=all`. */
export const allChannelsQuery = { channels: "all" } as const;
