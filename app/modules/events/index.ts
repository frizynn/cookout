/**
 * Live updates on the wire, shared by the server, the SDK and the web: the
 * events one Server-Sent Events stream sends (ADR 0002) and the stream's
 * path. Each event's SSE `event` field is its `type`, its SSE `id` is the
 * message ID, and its SSE `data` is the event as JSON. A stream that can't
 * go on ends with one `refusal` event instead.
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

/**
 * The SSE `event` of the stream's last event when it can't go on, such as `lease_lost` once another session takes
 * over the lease: it has no `id`, and its `data` is the refusal's `ErrorResponse` as JSON.
 */
export const refusalEvent = "refusal";
