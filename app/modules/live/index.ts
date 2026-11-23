/**
 * The `live` module: the web's one reader of the live stream, and the one
 * owner of `EventSource`. `createLive` opens the all-channels feed
 * (`GET /v1/events?channels=all`) through an adapter for each subscriber
 * (the board subscribes once, when its first store is read), checks each
 * event with the SDK's generated validators (`parseEvent`), and calls the
 * subscriber with it, for as long as the page lives. An event that doesn't match the protocol, or whose type the SDK
 * doesn't know, is dropped. Stores read the stream through `live`, never
 * `EventSource` directly.
 *
 * Two adapters: `eventSourceAdapter(url)` for the browser, whose `EventSource`
 * sends the session cookie and reconnects on its own, picking up from the last
 * event's ID; and `watchAdapter(client)`, the test adapter, which reads the
 * stream through the SDK's `watch` with the client's token, for jsdom, which
 * has no `EventSource` and keeps no cookies.
 */
import type { CookoutEvent, ServerSentEvent } from "../sdk/index.ts";
import type { LiveAdapter } from "./lib/adapter.ts";
import { parseEvent } from "../sdk/index.ts";

function checked(event: ServerSentEvent): CookoutEvent | null {
  try {
    return parseEvent(event);
  } catch {
    return null;
  }
}

/** The live stream: `subscribe` opens a stream of its own and calls `listener` with each event on it. */
export interface Live {
  readonly subscribe: (listener: (event: CookoutEvent) => void) => void;
}

/**
 * Makes the live stream on an adapter, whose `open` starts sending each Server-Sent Event to its callback.
 * @param adapter How a stream is opened.
 * @returns The live stream.
 */
export function createLive(adapter: LiveAdapter): Live {
  return {
    subscribe: (listener) => {
      adapter.open((raw) => {
        const event = checked(raw);
        if (event !== null) {
          listener(event);
        }
      });
    },
  };
}

export { eventSourceAdapter } from "./lib/event-source.ts";
export { watchAdapter } from "./lib/watch.ts";
