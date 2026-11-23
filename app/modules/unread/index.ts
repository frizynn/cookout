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
 * newest it holds read with the items.
 */
import type { Alerts, LiveAlerts } from "./lib/alerts.ts";
import type {
  ChannelName,
  CookoutClient,
  CookoutEvent,
  InboxItem,
  MessageId,
  OfflineAlert,
  Refusal,
} from "../sdk/index.ts";
import type { MarkAll, MarkAllState } from "./lib/mark-all.ts";
import { createInboxItems, readInto } from "./lib/inbox-items.ts";
import type { Earlier } from "./lib/earlier.ts";
import type { InboxItems } from "./lib/inbox-items.ts";
import type { Live } from "../live/index.ts";
import type { MessageMenu } from "./lib/message-menu.ts";
import type { NewLine } from "./lib/new-lines.ts";
import type { Notifier } from "./lib/notifier.ts";
import { createAlerts } from "./lib/alerts.ts";
import { createEarlier } from "./lib/earlier.ts";
import { createMarkAll } from "./lib/mark-all.ts";
import { createMarkUnread } from "./lib/mark-unread.ts";
import { createMessageMenu } from "./lib/message-menu.ts";
import { createNotifier } from "./lib/notifier.ts";
import { refusalOf } from "../sdk/index.ts";
import { withNewLines } from "./lib/new-lines.ts";

interface Held {
  readonly items: InboxItems;
  readonly alerts: LiveAlerts;
}

function loadedOf({ alerts, items }: Held, markAll: MarkAllState): UnreadState {
  return { alerts: alerts.unread(), items: items.list(), markAll, status: "loaded" };
}

interface Loading extends Held {
  readonly client: UnreadOptions["client"];
  readonly markAll: MarkAll;
  readonly onRead: (item: InboxItem) => void;
}

async function loadedOrFailed({ alerts, client, items, markAll, onRead }: Loading): Promise<UnreadState> {
  try {
    await readInto({ client, items, onAlerts: alerts.addAll, onRead });
    return loadedOf({ alerts, items }, markAll.state());
  } catch (error: unknown) {
    return { ...refusalOf(error), status: "failed" };
  }
}

function follow(live: Live | null, onEvent: (event: CookoutEvent) => void): void {
  if (live !== null) {
    live.subscribe(onEvent);
  }
}

interface Parts extends Held {
  readonly earlier: ReturnType<typeof createEarlier>;
}

function withAlerts(shown: Notifier<UnreadState>, alerts: readonly OfflineAlert[]): void {
  const current = shown.current();
  if (current.status === "loaded") {
    shown.publish({ ...current, alerts });
  }
}

function partsOf(options: UnreadOptions, shown: Notifier<UnreadState>): Parts {
  const items = createInboxItems();
  return {
    alerts: createAlerts({
      client: options.client,
      onChange: (unread) => {
        withAlerts(shown, unread);
      },
    }),
    earlier: createEarlier({ ...options, unread: items }),
    items,
  };
}

/** The unread inbox items, oldest first, once they have loaded. */
export type UnreadState =
  | { readonly status: "loading" }
  | {
      readonly status: "loaded";
      readonly items: readonly InboxItem[];
      readonly alerts: readonly OfflineAlert[];
      readonly markAll: MarkAllState;
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
}

/**
 * What the unread store is made with: an SDK client with the token of whoever is looking, how many inbox history items
 * a page (50 unless given), and the live stream.
 */
export interface UnreadOptions {
  readonly client: Pick<
    CookoutClient,
    "ackAll" | "inbox" | "inboxHistory" | "markOfflineAlertRead" | "markUnread" | "readPositions"
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
  const shown = createNotifier<UnreadState>({ status: "loading" });
  const { alerts, earlier, items } = partsOf(options, shown);
  let loading: Promise<void> | null = null;

  const markAll = createMarkAll({
    ...options,
    alerts,
    items,
    onChange: (state) => {
      shown.publish(loadedOf({ alerts, items }, state));
    },
    onRead: earlier.add,
  });

  function republish(): void {
    if (shown.current().status === "loaded") {
      shown.publish(loadedOf({ alerts, items }, markAll.state()));
    }
  }
  const markUnread = createMarkUnread({ client: options.client, dropRead: earlier.drop, items, onChange: republish });

  async function load(): Promise<void> {
    follow(options.live ?? null, (event) => {
      if (markUnread.receive(event) || items.receive(event, earlier.add) || alerts.receive(event)) {
        republish();
      }
    });
    shown.publish(await loadedOrFailed({ alerts, client: options.client, items, markAll, onRead: earlier.add }));
  }

  const menu = createMessageMenu(markUnread.markUnread);

  return withNewLines<
    Pick<Unread, "alerts" | "earlier" | "markAllRead" | "markUnread" | "menu" | "snapshot" | "subscribe">
  >({
    alerts,
    earlier,
    markAllRead: markAll.markAllRead,
    markUnread: menu.markUnread,
    menu,
    movesBack: items.movesBack,
    readPosition: items.readPosition,
    snapshot: shown.current,
    subscribe: (listener) => {
      loading ??= load();
      return shown.subscribe(listener);
    },
  });
}

export type { Earlier, EarlierState } from "./lib/earlier.ts";
export type { MarkAllState } from "./lib/mark-all.ts";
export type { Alerts, AlertsState } from "./lib/alerts.ts";
export type { MessageMenu } from "./lib/message-menu.ts";
export type { InboxRow } from "./lib/rows.ts";
export { rowsOf } from "./lib/rows.ts";
export type { ThreadNews, UnreadCounts, UnreadWhy } from "./lib/levels.ts";
export { NO_COUNTS, countsByChannel, countsOf, newsByThread } from "./lib/levels.ts";
