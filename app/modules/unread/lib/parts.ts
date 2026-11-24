import type { CookoutClient, InboxItem, Nudge, OfflineAlert, Refusal } from "../../sdk/index.ts";
import { createInboxItems, readInto } from "./inbox-items.ts";
import type { InboxItems } from "./inbox-items.ts";
import type { LiveAlerts } from "./alerts.ts";
import type { LiveNudges } from "./nudges.ts";
import type { MarkAllState } from "./mark-all.ts";
import type { Notifier } from "./notifier.ts";
import { createAlerts } from "./alerts.ts";
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
      readonly markAll: MarkAllState;
    }
  | (Refusal & { readonly status: "failed" });

interface PartsOptions {
  readonly client: Pick<
    CookoutClient,
    "closeThread" | "inbox" | "inboxHistory" | "markNudgeRead" | "markOfflineAlertRead" | "readPositions"
  >;
  readonly pageSize?: number;
}

interface Held {
  readonly items: InboxItems;
  readonly alerts: LiveAlerts;
  readonly nudges: LiveNudges;
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

type Beside = { readonly alerts: readonly OfflineAlert[] } | { readonly nudges: readonly Nudge[] };

function loadedOf({ alerts, items, markAll, nudges }: Shown): UnreadState {
  return {
    alerts: alerts.unread(),
    inbox: items.inbox(),
    items: items.list(),
    markAll,
    nudges: nudges.unread(),
    status: "loaded",
  };
}

async function loadedOrFailed({ alerts, client, earlier, items, markAll, nudges }: Loading): Promise<UnreadState> {
  try {
    await readInto({ client, items, onAlerts: alerts.addAll, onNudges: nudges.addUnread, onRead: earlier.add });
    return loadedOf({ alerts, items, markAll: markAll(), nudges });
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

export { type UnreadState, loadedOf, loadedOrFailed, partsOf };
