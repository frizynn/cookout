/**
 * The `unread` store: the unread inbox items of whoever is looking, oldest
 * first. An external store, read by components with `useSyncExternalStore`.
 * The items come from the same query as the API's: when its first reader
 * subscribes it loads the inbox (`GET /v1/inbox`), a message there for
 * several reasons held once. With `live`, it follows the live stream from then
 * on: each new inbox item (`inbox-item`) joins them, and each new read
 * position (`read-position`, from this tab's ack on view or any other
 * session's) drops the items it covers, so opening a channel or a thread takes
 * its messages out. It never acks anything itself: a message is read only once
 * some view acks it. A refusal keeps the server's error code; a server that
 * can't be reached is `unreachable`. The items have two levels, as Slack
 * shows them (Matt, #152, 2026-11-23): for you (a mention, or a reply in a
 * thread you started) and activity (the rest). A row says why it is there,
 * `countsByChannel` counts both levels by channel, and `newsByThread` counts a
 * thread's unread replies and how many of them are for you. `rowsOf` groups
 * items, unread or `earlier`'s, into the inbox's rows: one per thread (its
 * replies) or channel (its top-level messages), as read positions are keyed,
 * each with its latest item, count, level and strongest reason, newest first.
 * Being derived from the items, the rows move with every live path above.
 * `earlier` is the read part of the inbox, for the inbox view's Earlier list:
 * when its first reader subscribes it loads the inbox history
 * (`GET /v1/inbox/history`) a page of `pageSize` items at a time (50 unless
 * given), keeping the read ones newest first and reading on until a page
 * holds one, and `loadMore` reads the next page; its state says the page size,
 * for the "Show 50 earlier" button. An item a read position
 * takes out of the counts joins it, so opening an item moves it there.
 * It loads the caller's read positions (`GET /v1/read-positions`) with the
 * inbox and follows them by `read-position`. `newLine` is where a channel's or
 * thread's "New" line goes: its read position when the view opened, so the
 * line sits above the first message after it, kept while the view is open.
 * A closed thread's items, by their `parent`'s `closedAt`, are
 * left out of `inbox`, what the Inbox lists and counts and the sidebar counts
 * by channel, and come back when it
 * reopens, following `thread` events live; they stay in `items` and stay
 * unread on the server, where an agent's inbox still lists them.
 * `markAllRead` acks the whole inbox up to the newest item the store holds
 * (`POST /v1/inbox/ack-all`) and drops the items the read positions it moved
 * cover, so a message that arrives meanwhile stays unread. `markUnread` marks
 * a message unread (`POST /v1/read-positions/unread`): it and each read
 * position moved back (`read-position-moved-back`, from any session) replace
 * the read position there, though it was newer, take the items after it out of
 * `earlier`, read the inbox again to bring them back, and move the "New" line
 * of a view open there above the first of them, or above every message when
 * it was a channel's first. `menu` is what a message's actions menu uses: its
 * Mark unread calls `markUnread`, and its `refusal` is why the last
 * Mark unread was refused, until the next one. `alerts` holds the caller's offline alerts: the unread ones, from the
 * inbox and each `offline-alert` event, join the loaded state beside the items, and its own snapshot, loaded from the
 * inbox history's first page, lists them all, read or not, for the Earlier list. Marking one read
 * (`POST /v1/inbox/alerts/:id/read`) takes it out of the unread ones, and `markAllRead` marks every alert up to the
 * newest it holds read with the items. `nudges` holds the caller's Nudges the same way: the unread ones, from the inbox
 * and each `nudge` event, join the loaded state beside the items, and its own snapshot, from the inbox history's first
 * page, lists them all for the Earlier list. One turns read when it is marked read (`POST /v1/inbox/nudges/:id/read`),
 * with `markAllRead`, when `close` closes its thread (`PUT` on the thread's close route), and live when a `thread`
 * event closes its thread or a `message` event brings a reply in it, as the server reads it then.
 */
import type { ChannelName, CookoutClient, CookoutEvent, MessageId } from "../sdk/index.ts";
import { loadedOf, loadedOrFailed, partsOf } from "./lib/parts.ts";
import type { Alerts } from "./lib/alerts.ts";
import type { Earlier } from "./lib/earlier.ts";
import type { Live } from "../live/index.ts";
import type { MessageMenu } from "./lib/message-menu.ts";
import type { NewLine } from "./lib/new-lines.ts";
import type { Nudges } from "./lib/nudges.ts";
import type { UnreadState } from "./lib/parts.ts";
import { createMarkAll } from "./lib/mark-all.ts";
import { createMarkUnread } from "./lib/mark-unread.ts";
import { createMessageMenu } from "./lib/message-menu.ts";
import { withNewLines } from "./lib/new-lines.ts";

function follow(live: Live | null, onEvent: (event: CookoutEvent) => void): void {
  if (live !== null) {
    live.subscribe(onEvent);
  }
}

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
   * message after it; `null`, with no line, where nothing there has been read; `0`, above every message, where marking
   * a channel's first message unread left nothing read. It stays put while anyone reads it,
   * though the view's own ack moves the read position, and is read afresh when it is opened again.
   */
  readonly newLine: (channel: ChannelName, thread: MessageId | null) => NewLine;
  /** Marks every inbox item the store holds as read, in every channel and thread, leaving any newer one unread. */
  readonly markAllRead: () => void;
  /** Marks a message, and everything after it in its thread or channel, unread again; a refusal shows as `menu.refusal`. */
  readonly markUnread: (messageId: MessageId) => void;
  /** What a message's actions menu needs: Mark unread, and why the last one was refused. An external store of its own. */
  readonly menu: MessageMenu;
  /** Every offline alert of the caller's, read or not, newest first, and marking one read: an external store of its own. */
  readonly alerts: Alerts;
  /** Every Nudge of the caller's, read or not, newest first, marking one read and closing its thread: a store of its own. */
  readonly nudges: Nudges;
}

/**
 * What the unread store is made with: an SDK client with the token of whoever is looking, how many inbox history items
 * a page (50 unless given), and the live stream.
 */
export interface UnreadOptions {
  readonly client: Pick<
    CookoutClient,
    | "ackAll"
    | "closeThread"
    | "inbox"
    | "inboxHistory"
    | "markNudgeRead"
    | "markOfflineAlertRead"
    | "markUnread"
    | "readPositions"
  >;
  readonly pageSize?: number;
  readonly live?: Live;
}

/**
 * Makes an unread store that reads the inbox through `options.client` and follows `options.live`.
 * @param options The client and the live stream.
 * @returns The store.
 */
export function createUnread(options: UnreadOptions): Unread {
  const parts = partsOf(options);
  const { alerts, earlier, items, nudges, shown } = parts;
  let loading: Promise<void> | null = null;
  const markAll = createMarkAll({
    ...options,
    ...parts,
    onChange: (state) => {
      shown.publish(loadedOf({ ...parts, markAll: state }));
    },
    onRead: earlier.add,
  });

  function republish(): void {
    if (shown.current().status === "loaded") {
      shown.publish(loadedOf({ ...parts, markAll: markAll.state() }));
    }
  }
  const markUnread = createMarkUnread({ client: options.client, dropRead: earlier.drop, items, onChange: republish });

  async function load(): Promise<void> {
    follow(options.live ?? null, (event) => {
      const nudged = nudges.receive(event);
      if (markUnread.receive(event) || items.receive(event, earlier.add) || alerts.receive(event) || nudged) {
        republish();
      }
    });
    shown.publish(await loadedOrFailed({ ...parts, client: options.client, markAll: markAll.state }));
  }
  const menu = createMessageMenu(markUnread.markUnread);

  return withNewLines<
    Pick<Unread, "alerts" | "earlier" | "markAllRead" | "markUnread" | "menu" | "nudges" | "snapshot" | "subscribe">
  >({
    alerts,
    earlier,
    markAllRead: markAll.markAllRead,
    markUnread: menu.markUnread,
    menu,
    movesBack: items.movesBack,
    nudges,
    readPosition: items.readPosition,
    snapshot: shown.current,
    subscribe: (listener) => {
      loading ??= load();
      return shown.subscribe(listener);
    },
  });
}

/**
 * The unread inbox items, oldest first, once they have loaded; `inbox`, what the Inbox and the sidebar show and count,
 * is `items` but those of a closed thread. Beside them are the unread offline alerts and the unread Nudges, newest first.
 */
export type { UnreadState } from "./lib/parts.ts";
export type { Earlier, EarlierState } from "./lib/earlier.ts";
export type { MarkAllState } from "./lib/mark-all.ts";
export type { Alerts, AlertsState } from "./lib/alerts.ts";
export type { Nudges, NudgesState } from "./lib/nudges.ts";
export type { MessageMenu } from "./lib/message-menu.ts";
export type { InboxRow } from "./lib/rows.ts";
export { rowsOf } from "./lib/rows.ts";
export type { ThreadNews, UnreadCounts, UnreadWhy } from "./lib/levels.ts";
export { NO_COUNTS, countsByChannel, countsOf, newsByThread } from "./lib/levels.ts";
