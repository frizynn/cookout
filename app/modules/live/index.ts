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
 * The adapter also reports the stream's link to the server going `down` and
 * coming back `up`. `link` is the link as last reported (`up` until it is
 * reported down), and `subscribeToLink` calls its listener on each change, so
 * a view can show that the page may be stale. `onBack` calls its listener each
 * time the link comes back after being down, so every store that shows what
 * the stream tells it (the identity directory, the channel list, open channels
 * and threads, the unread store) can read again what it missed: the web
 * doesn't rely on the stream replaying anything (ADR
 * `docs/adr/0056-a-page-catches-up-by-reading-again.md`).
 *
 * The browser's adapter is `eventSourceAdapter(url)`, whose `EventSource`
 * sends the session cookie and reconnects on its own, picking up from the last
 * event's ID; it reports the link down on the source's `error` and up on its
 * `open`. Tests in jsdom, which has no `EventSource` and keeps no cookies,
 * bring their own `LiveAdapter` (the testing module's `watchAdapter`).
 */
import type { CookoutEvent, ServerSentEvent } from "../sdk/index.ts";
import type { Link, LiveAdapter } from "./lib/adapter.ts";
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
  /** The stream's link to the server as last reported: `up` until the adapter reports it down. */
  readonly link: () => Link;
  /** Calls `listener` each time the link goes down or comes back, until the returned function is called. */
  readonly subscribeToLink: (listener: () => void) => () => void;
  /** Calls `listener` each time the link comes back after being down. */
  readonly onBack: (listener: () => void) => void;
}

/**
 * Makes the live stream on an adapter, whose `open` starts sending each Server-Sent Event to its callback.
 * @param adapter How a stream is opened.
 * @returns The live stream.
 */
export function createLive(adapter: LiveAdapter): Live {
  const listeners: ((event: CookoutEvent) => void)[] = [];
  const linkListeners = new Set<() => void>();
  const backListeners: (() => void)[] = [];
  let opened = false;
  let link: Link = "up";

  function reported(next: Link): void {
    if (next === link) {
      return;
    }
    link = next;
    for (const listener of linkListeners) {
      listener();
    }
    if (next === "up") {
      for (const listener of backListeners) {
        listener();
      }
    }
  }

  return {
    link: () => link,
    onBack: (listener) => {
      backListeners.push(listener);
    },
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
      }, reported);
    },
    subscribeToLink: (listener) => {
      linkListeners.add(listener);
      return () => {
        linkListeners.delete(listener);
      };
    },
  };
}

export { eventSourceAdapter } from "./lib/event-source.ts";
export type { LiveAdapter } from "./lib/adapter.ts";
