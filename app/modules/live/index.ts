/**
 * The `live` module: the web's one reader of the live stream, and the one
 * owner of `EventSource`. `createLive` opens the all-channels feed
 * (`GET /v1/events?channels=all`) through an adapter once, when its first
 * subscriber arrives (the board and the unread store each subscribe once, when
 * first read), checks each event with the SDK's generated validators
 * (`parseEvent`), and calls every subscriber with it, for as long as the page
 * lives. An event that doesn't match the protocol, or whose type the SDK
 * doesn't know, is dropped. Stores read the stream through `live`, never
 * `EventSource` directly.
 *
 * The browser's adapter is `eventSourceAdapter(url)`, whose `EventSource`
 * sends the session cookie and reconnects on its own, picking up from the last
 * event's ID. Tests in jsdom, which has no `EventSource` and keeps no cookies,
 * bring their own `LiveAdapter` (the testing module's `watchAdapter`).
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

/** The live stream: `subscribe` calls `listener` with each event on it, opening the stream for the first listener. */
export interface Live {
  readonly subscribe: (listener: (event: CookoutEvent) => void) => void;
}

/**
 * Makes the live stream on an adapter, whose `open` starts sending each Server-Sent Event to its callback.
 * @param adapter How a stream is opened.
 * @returns The live stream.
 */
export function createLive(adapter: LiveAdapter): Live {
  const listeners: ((event: CookoutEvent) => void)[] = [];
  let opened = false;
  return {
    subscribe: (listener) => {
      listeners.push(listener);
      if (opened) {
        return;
      }
      opened = true;
      adapter.open((raw) => {
        const event = checked(raw);
        if (event !== null) {
          for (const each of listeners) {
            each(event);
          }
        }
      });
    },
  };
}

export { eventSourceAdapter } from "./lib/event-source.ts";
export type { LiveAdapter } from "./lib/adapter.ts";
