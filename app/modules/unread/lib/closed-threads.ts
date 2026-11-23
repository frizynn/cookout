import type { InboxItem, MessageId, TopLevelMessage } from "../../sdk/index.ts";

function isOpen(item: InboxItem): boolean {
  return typeof item.parent.closedAt !== "string";
}

function openOnly(items: readonly InboxItem[]): readonly InboxItem[] {
  return items.filter((item) => isOpen(item));
}

interface Reparenting {
  readonly items: Map<MessageId, InboxItem>;
  readonly parent: TopLevelMessage;
}

function reparent({ items, parent }: Reparenting): boolean {
  let held = false;
  for (const [id, item] of items) {
    if (item.parent.id === parent.id) {
      items.set(id, { ...item, parent });
      held = true;
    }
  }
  return held;
}

export { openOnly, reparent };
