import type { CookoutClient, InboxItem, Refusal } from "../../sdk/index.ts";
import type { InboxItems } from "./inbox-items.ts";
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
  readonly onRead: (item: InboxItem) => void;
  readonly onChange: (state: MarkAllState) => void;
}

function createMarkAll({ client, items, onChange, onRead }: MarkAllOptions): MarkAll {
  let state: MarkAllState = { status: "idle" };
  let queue: Promise<void> = Promise.resolve();

  function change(next: MarkAllState): void {
    state = next;
    onChange(next);
  }

  async function markAfter(previous: Promise<void>, newest: InboxItem): Promise<void> {
    await previous;
    change({ status: "marking" });
    try {
      const { readPositions } = await client.ackAll(newest.message.id);
      items.readAll(readPositions, onRead);
      change({ status: "idle" });
    } catch (error: unknown) {
      change({ ...refusalOf(error), status: "failed" });
    }
  }

  return {
    markAllRead: () => {
      for (const newest of items.list().slice(LAST_ONE)) {
        queue = markAfter(queue, newest);
      }
    },
    state: () => state,
  };
}

export { type MarkAll, type MarkAllState, createMarkAll };
