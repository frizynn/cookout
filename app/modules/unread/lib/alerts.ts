import type { CookoutClient, CookoutEvent, OfflineAlert, OfflineAlertId } from "../../sdk/index.ts";
import type { Notifier } from "./notifier.ts";
import { createNotifier } from "./notifier.ts";

type AlertsState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly alerts: readonly OfflineAlert[] }
  | { readonly status: "failed" };

interface Alerts {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => AlertsState;
  readonly markRead: (id: OfflineAlertId) => void;
}

interface LiveAlerts extends Alerts {
  readonly addAll: (alerts: readonly OfflineAlert[]) => void;
  readonly receive: (event: CookoutEvent) => boolean;
  readonly unread: () => readonly OfflineAlert[];
  readonly newestUnread: () => OfflineAlertId | null;
}

interface AlertsOptions {
  readonly client: Pick<CookoutClient, "inboxHistory" | "markOfflineAlertRead">;
  readonly onChange: (unread: readonly OfflineAlert[]) => void;
}

interface Known {
  readonly addAll: (alerts: readonly OfflineAlert[]) => void;
  readonly unread: () => readonly OfflineAlert[];
  readonly historyRead: () => void;
}

const FIRST_PAGE = { limit: 1 } as const;

function newestFirst(alerts: Iterable<OfflineAlert>): readonly OfflineAlert[] {
  return [...alerts].toSorted((first, second) => second.id - first.id);
}

function knownAlerts(shown: Notifier<AlertsState>, onChange: AlertsOptions["onChange"]): Known {
  const known = new Map<OfflineAlertId, OfflineAlert>();
  let loaded = false;
  function unread(): readonly OfflineAlert[] {
    return newestFirst(known.values()).filter(({ read }) => !read);
  }
  function addAll(alerts: readonly OfflineAlert[]): void {
    for (const alert of alerts) {
      known.set(alert.id, alert);
    }
    if (loaded) {
      shown.publish({ alerts: newestFirst(known.values()), status: "loaded" });
    }
    onChange(unread());
  }
  return {
    addAll,
    historyRead: () => {
      loaded = true;
    },
    unread,
  };
}

function newestIdOf(alerts: readonly OfflineAlert[]): OfflineAlertId | null {
  const [newest = null] = alerts;
  if (newest === null) {
    return null;
  }
  return newest.id;
}

function createAlerts({ client, onChange }: AlertsOptions): LiveAlerts {
  const shown = createNotifier<AlertsState>({ status: "loading" });
  const known = knownAlerts(shown, onChange);
  let loading: Promise<void> | null = null;
  let marking: Promise<void> = Promise.resolve();

  async function readHistory(): Promise<void> {
    try {
      const { alerts } = await client.inboxHistory(FIRST_PAGE);
      known.historyRead();
      known.addAll(alerts);
    } catch {
      shown.publish({ status: "failed" });
    }
  }

  async function markAfter(previous: Promise<void>, id: OfflineAlertId): Promise<void> {
    await previous;
    try {
      const { alert } = await client.markOfflineAlertRead(id);
      known.addAll([alert]);
    } catch {
      known.addAll([]);
    }
  }

  return {
    addAll: known.addAll,
    markRead: (id) => {
      marking = markAfter(marking, id);
    },
    newestUnread: () => newestIdOf(known.unread()),
    receive: (event) => {
      if (event.type !== "offline-alert") {
        return false;
      }
      known.addAll([event.alert]);
      return true;
    },
    snapshot: shown.current,
    subscribe: (listener) => {
      loading ??= readHistory();
      return shown.subscribe(listener);
    },
    unread: known.unread,
  };
}

export { type Alerts, type AlertsState, type LiveAlerts, createAlerts };
