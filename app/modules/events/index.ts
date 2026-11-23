/**
 * Live updates on the wire, shared by the server, the SDK and the web: the
 * events one Server-Sent Events stream sends (ADR 0002) and the stream's
 * path. Each event's SSE `event` field is its `type`, its SSE `id` is the
 * message ID, and its SSE `data` is the event as JSON.
 */
import type { InboxItem } from "../inbox/index.ts";

/** A new item in the caller's inbox, sent the moment another identity posts it. */
export interface InboxItemEvent {
  readonly type: "inbox-item";
  readonly item: InboxItem;
}

/** Any event the stream sends. */
export type CookoutEvent = InboxItemEvent;

/** `GET /v1/events`: the caller's Server-Sent Events stream, one per connection. */
export const eventsPath = "/v1/events";
