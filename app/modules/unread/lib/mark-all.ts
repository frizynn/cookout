import type { AckAllRequest, CookoutClient, InboxItem, Refusal } from "../../sdk/index.ts";
import type { InboxItems } from "./inbox-items.ts";
import type { LiveAlerts } from "./alerts.ts";
import { refusalOf } from "../../sdk/index.ts";

const LAST_ONE = -1;

type MarkAllState =
  | { readonly status: "idle" }
  | { readonly status: "marking" }
  | (Refusal & { readonly status: "failed" });

interface MarkAll {
  readonly state: () => MarkAllState;
  readonly markAllRead: () => void;
}

interface MarkAllOptions {
  readonly client: Pick<CookoutClient, "ackAll">;
  readonly items: InboxItems;
  readonly alerts: LiveAlerts;
  readonly onRead: (item: InboxItem) => void;
  readonly onChange: (state: MarkAllState) => void;
}

function upToOf(items: InboxItems): Pick<AckAllRequest, "upTo"> {
  const [newest = null] = items.list().slice(LAST_ONE);
  if (newest === null) {
    return {};
  }
  return { upTo: newest.message.id };
}

function alertsUpToOf(alerts: LiveAlerts): Pick<AckAllRequest, "alertsUpTo"> {
  const alertsUpTo = alerts.newestUnread();
  if (alertsUpTo === null) {
    return {};
  }
  return { alertsUpTo };
}

function createMarkAll({ alerts, client, items, onChange, onRead }: MarkAllOptions): MarkAll {
  let state: MarkAllState = { status: "idle" };
  let queue: Promise<void> = Promise.resolve();

  function change(next: MarkAllState): void {
    state = next;
    onChange(next);
  }

  async function markAfter(previous: Promise<void>, request: AckAllRequest): Promise<void> {
    await previous;
    change({ status: "marking" });
    try {
      const { alerts: read, readPositions } = await client.ackAll(request);
      items.readAll(readPositions, onRead);
      alerts.addAll(read);
      change({ status: "idle" });
    } catch (error: unknown) {
      change({ ...refusalOf(error), status: "failed" });
    }
  }

  return {
    markAllRead: () => {
      queue = markAfter(queue, { ...upToOf(items), ...alertsUpToOf(alerts) });
    },
    state: () => state,
  };
}

export { type MarkAll, type MarkAllState, createMarkAll };
