/**
 * The `unread` store: how many unread messages each channel holds for whoever
 * is looking, with the ones that mention them counted apart from the rest
 * (`mentions` and `plain`), as Slack shows them. An external store, read by
 * components with `useSyncExternalStore`. The counts come from the same query
 * as the API's: when its first reader subscribes it loads the inbox
 * (`GET /v1/inbox`) and counts its items by channel, a message there for
 * several reasons counted once. With `live`, it follows the live stream from
 * then on: each new inbox item (`inbox-item`) raises its channel's count, and
 * each new read position (`read-position`, from this tab's ack on view or any
 * other session's) drops the items it covers, so opening a channel or a thread
 * takes its messages out of the counts. It never acks anything itself: a
 * message is read only once some view acks it. A refusal keeps the server's
 * error code; a server that can't be reached is `unreachable`. Alongside the
 * counts it keeps the inbox items they count, oldest first, for the inbox view.
 * `earlier` is the read part of the inbox, for the inbox view's Earlier list:
 * when its first reader subscribes it loads the inbox history
 * (`GET /v1/inbox/history`) a page of `pageSize` items at a time (50 unless
 * given), keeping the read ones newest first and reading on until a page
 * holds one, and `loadMore` reads the next page. An item a read position
 * takes out of the counts joins it, so opening an item moves it there.
 * It loads the caller's read positions (`GET /v1/read-positions`) with the
 * inbox and follows them by `read-position`. `newLine` is where a channel's or
 * thread's "New" line goes: its read position when the view opened, so the
 * line sits above the first message after it, kept while the view is open.
 */
import type { ChannelName, CookoutClient, CookoutEvent, InboxItem, MessageId, Refusal } from "../sdk/index.ts";
import { createInboxItems, readInto } from "./lib/inbox-items.ts";
import type { Earlier } from "./lib/earlier.ts";
import type { Live } from "../live/index.ts";
import type { NewLine } from "./lib/new-lines.ts";
import type { UnreadCounts } from "./lib/inbox-items.ts";
import { createEarlier } from "./lib/earlier.ts";
import { refusalOf } from "../sdk/index.ts";
import { withNewLines } from "./lib/new-lines.ts";

/**
 * The counts by channel name, as far as they have loaded, and the inbox items they count, oldest first; a channel with
 * nothing unread isn't in `channels`.
 */
export type UnreadState =
  | { readonly status: "loading" }
  | {
      readonly status: "loaded";
      readonly channels: ReadonlyMap<ChannelName, UnreadCounts>;
      readonly items: readonly InboxItem[];
    }
  | (Refusal & { readonly status: "failed" });

/** The unread store. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Unread {
  /** Calls `listener` after every change, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The current snapshot: a new object whenever a count changes, the same one until then. */
  readonly snapshot: () => UnreadState;
  /** The read inbox items, newest first, a page at a time: an external store of its own. */
  readonly earlier: Earlier;
  /**
   * Where the "New" line goes in a channel's top-level messages (`thread` is `null`) or a thread's replies: the read
   * position there when its first reader subscribed, once the counts have loaded, so the line sits above the first
   * message after it; `null`, with no line, where nothing there has been read. It stays put while anyone reads it,
   * though the view's own ack moves the read position, and is read afresh when it is opened again.
   */
  readonly newLine: (channel: ChannelName, thread: MessageId | null) => NewLine;
}

/**
 * What the unread store is made with: an SDK client with the token of whoever is looking, how many inbox history items
 * a page (50 unless given), and the live stream.
 */
export interface UnreadOptions {
  readonly client: Pick<CookoutClient, "inbox" | "inboxHistory" | "readPositions">;
  readonly pageSize?: number;
  readonly live?: Live;
}

/**
 * Makes an unread store that reads the inbox through `options.client` and follows `options.live`.
 * @param options The client and the live stream.
 * @returns The store.
 */
export function createUnread(options: UnreadOptions): Unread {
  const listeners = new Set<() => void>();
  const items = createInboxItems();
  const earlier = createEarlier({ ...options, unread: items });
  let current: UnreadState = { status: "loading" };
  let loading: Promise<void> | null = null;

  function publish(state: UnreadState): void {
    current = state;
    for (const listener of listeners) {
      listener();
    }
  }

  function loaded(): UnreadState {
    return { channels: items.counts(), items: items.list(), status: "loaded" };
  }

  function receive(event: CookoutEvent): void {
    if (items.receive(event, earlier.add) && current.status === "loaded") {
      publish(loaded());
    }
  }

  async function load(): Promise<void> {
    const live = options.live ?? null;
    if (live !== null) {
      live.subscribe(receive);
    }
    try {
      await readInto({ client: options.client, items, onRead: earlier.add });
      publish(loaded());
    } catch (error: unknown) {
      publish({ ...refusalOf(error), status: "failed" });
    }
  }

  return withNewLines<Pick<Unread, "earlier" | "snapshot" | "subscribe">>({
    earlier,
    readPosition: items.readPosition,
    snapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      loading ??= load();
      return () => {
        listeners.delete(listener);
      };
    },
  });
}

export type { Earlier, EarlierState } from "./lib/earlier.ts";
export type { UnreadCounts } from "./lib/inbox-items.ts";
