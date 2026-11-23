/**
 * The `live` module: the web's one reader of the live stream, and the one
 * owner of `EventSource`. `createLive` opens the all-channels feed
 * (`GET /v1/events?channels=all`) through an adapter when its first listener
 * subscribes, checks each event with the SDK's generated validators, and
 * calls every listener with it; it closes the stream when the last listener
 * goes. An event that doesn't match the protocol is dropped. Stores read the
 * stream through `live`, never `EventSource` directly.
 *
 * Two adapters: `eventSourceAdapter(url)` for the browser, whose `EventSource`
 * sends the session cookie and reconnects on its own, picking up from the last
 * event's ID; and `watchAdapter(client)`, the test adapter, which reads the
 * stream through the SDK's `watch`, for jsdom, which has no `EventSource` and
 * keeps no cookies. A stream the test adapter can't open just sends nothing.
 */
import type { CookoutEvent, ServerSentEvent } from "../sdk/index.ts";
import type { LiveAdapter } from "./lib/adapter.ts";
import { parseEvent } from "../sdk/index.ts";

const NONE = 0;

function checked(event: ServerSentEvent): CookoutEvent | null {
  try {
    return parseEvent(event);
  } catch {
    return null;
  }
}

/** The live stream: `subscribe` calls `listener` with each event, until the returned function is called. */
export interface Live {
  readonly subscribe: (listener: (event: CookoutEvent) => void) => () => void;
}

/**
 * Makes the live stream on an adapter.
 * @param adapter How the stream is opened: `open` starts sending each event to its callback and returns the function that stops it.
 * @returns The stream, opened by its first listener.
 */
export function createLive(adapter: LiveAdapter): Live {
  const listeners = new Set<(event: CookoutEvent) => void>();
  let close: (() => void) | null = null;

  function deliver(raw: ServerSentEvent): void {
    const event = checked(raw);
    if (event === null) {
      return;
    }
    for (const listener of listeners) {
      listener(event);
    }
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      close ??= adapter.open(deliver);
      return () => {
        listeners.delete(listener);
        if (listeners.size === NONE && close !== null) {
          close();
          close = null;
        }
      };
    },
  };
}

export { eventSourceAdapter } from "./lib/event-source.ts";
export { watchAdapter } from "./lib/watch.ts";
