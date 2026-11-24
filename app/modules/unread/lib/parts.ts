import type { CookoutClient, DeactivationOffer, InboxItem, Nudge, OfflineAlert, Refusal } from "../../sdk/index.ts";
import { catchingUp, createInboxItems, readInto } from "./inbox-items.ts";
import type { InboxItems } from "./inbox-items.ts";
import type { Live } from "../../live/index.ts";
import type { LiveAlerts } from "./alerts.ts";
import type { LiveDeactivationOffers } from "./deactivation-offers.ts";
import type { LiveNudges } from "./nudges.ts";
import type { MarkAllState } from "./mark-all.ts";
import type { MarkUnread } from "./mark-unread.ts";
import type { Notifier } from "./notifier.ts";
import { createAlerts } from "./alerts.ts";
import { createDeactivationOffers } from "./deactivation-offers.ts";
import { createEarlier } from "./earlier.ts";
import { createNotifier } from "./notifier.ts";
import { createNudges } from "./nudges.ts";
import { refusalOf } from "../../sdk/index.ts";

type UnreadState =
  | { readonly status: "loading" }
  | {
      readonly status: "loaded";
      readonly items: readonly InboxItem[];
      readonly inbox: readonly InboxItem[];
      readonly alerts: readonly OfflineAlert[];
      readonly nudges: readonly Nudge[];
      readonly deactivationOffers: readonly DeactivationOffer[];
      readonly markAll: MarkAllState;
    }
  | (Refusal & { readonly status: "failed" });

interface PartsOptions {
  readonly client: Pick<
    CookoutClient,
    | "closeThread"
    | "inbox"
    | "inboxHistory"
    | "keepDeactivationOffer"
    | "markNudgeRead"
    | "markOfflineAlertRead"
    | "readPositions"
  >;
  readonly pageSize?: number;
}

interface Held {
  readonly items: InboxItems;
  readonly alerts: LiveAlerts;
  readonly nudges: LiveNudges;
  readonly deactivationOffers: LiveDeactivationOffers;
}

interface Parts extends Held {
  readonly shown: Notifier<UnreadState>;
  readonly earlier: ReturnType<typeof createEarlier>;
}

interface Loading extends Held {
  readonly client: PartsOptions["client"];
  readonly markAll: () => MarkAllState;
  readonly earlier: { readonly add: (item: InboxItem) => void };
}

interface Shown extends Held {
  readonly markAll: MarkAllState;
}

interface Following extends Held {
  readonly client: PartsOptions["client"];
  readonly earlier: ReturnType<typeof createEarlier>;
  readonly live: Live | null;
  readonly markUnread: MarkUnread;
  readonly republish: () => void;
}

type Beside =
  | { readonly alerts: readonly OfflineAlert[] }
  | { readonly nudges: readonly Nudge[] }
  | { readonly deactivationOffers: readonly DeactivationOffer[] };

function loadedOf({ alerts, deactivationOffers, items, markAll, nudges }: Shown): UnreadState {
  return {
    alerts: alerts.unread(),
    deactivationOffers: deactivationOffers.open(),
    inbox: items.inbox(),
    items: items.list(),
    markAll,
    nudges: nudges.unread(),
    status: "loaded",
  };
}

async function loadedOrFailed(loading: Loading): Promise<UnreadState> {
  const { alerts, client, deactivationOffers, earlier, items, markAll, nudges } = loading;
  try {
    await readInto({
      client,
      items,
      onAlerts: alerts.addAll,
      onDeactivationOffers: deactivationOffers.openAre,
      onNudges: nudges.addUnread,
      onRead: earlier.add,
    });
    return loadedOf({ alerts, deactivationOffers, items, markAll: markAll(), nudges });
  } catch (error: unknown) {
    return { ...refusalOf(error), status: "failed" };
  }
}

function withBeside(shown: Notifier<UnreadState>, beside: Beside): void {
  const current = shown.current();
  if (current.status === "loaded") {
    shown.publish({ ...current, ...beside });
  }
}

function partsOf(options: PartsOptions): Parts {
  const shown = createNotifier<UnreadState>({ status: "loading" });
  const items = createInboxItems();
  return {
    alerts: createAlerts({
      client: options.client,
      onChange: (unread) => {
        withBeside(shown, { alerts: unread });
      },
    }),
    deactivationOffers: createDeactivationOffers({
      client: options.client,
      onChange: (open) => {
        withBeside(shown, { deactivationOffers: open });
      },
    }),
    earlier: createEarlier({ ...options, unread: items }),
    items,
    nudges: createNudges({
      client: options.client,
      onChange: (unread) => {
        withBeside(shown, { nudges: unread });
      },
    }),
    shown,
  };
}

function follow(following: Following): void {
  const { alerts, client, deactivationOffers, earlier, items, live, markUnread, nudges, republish } = following;
  if (live === null) {
    return;
  }
  live.subscribe((event) => {
    const besides = [nudges.receive(event), deactivationOffers.receive(event)];
    if (
      markUnread.receive(event) ||
      items.receive(event, earlier.add) ||
      alerts.receive(event) ||
      besides.includes(true)
    ) {
      republish();
    }
  });
  live.onBack(
    catchingUp({
      client,
      items,
      moveBack: markUnread.moveBack,
      onAlerts: alerts.addAll,
      onChange: republish,
      onDeactivationOffers: deactivationOffers.openAre,
      onNudges: nudges.addUnread,
      onRead: earlier.add,
    }),
  );
}

export type { DeactivationOffers } from "./deactivation-offers.ts";
export { type UnreadState, follow, loadedOf, loadedOrFailed, partsOf };
