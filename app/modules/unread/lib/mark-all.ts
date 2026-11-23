import type { AckAllRequest, CookoutClient, InboxItem, OfflineAlertId, Refusal } from "../../sdk/index.ts";
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

function alertsOnly(alertsUpTo: OfflineAlertId | null): AckAllRequest | null {
  if (alertsUpTo === null) {
    return null;
  }
  return { alertsUpTo };
}

function requestOf({ alerts, items }: Pick<MarkAllOptions, "alerts" | "items">): AckAllRequest | null {
  const [newest = null] = items.list().slice(LAST_ONE);
  const alertsUpTo = alerts.newestUnread();
  if (newest === null) {
    return alertsOnly(alertsUpTo);
  }
  if (alertsUpTo === null) {
    return { upTo: newest.message.id };
  }
  return { alertsUpTo, upTo: newest.message.id };
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
      const request = requestOf({ alerts, items });
      if (request !== null) {
        queue = markAfter(queue, request);
      }
    },
    state: () => state,
  };
}

export { type MarkAll, type MarkAllState, createMarkAll };
