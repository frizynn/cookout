import { CONVERSATION_KEYS } from "../../design-system/index.tsx";

type InboxKey = "next" | "previous" | "reply" | "back" | "read" | "unread" | "open";

const SHORTCUTS = CONVERSATION_KEYS;

const KEYS: ReadonlyMap<string, InboxKey> = new Map([
  ["ArrowDown", "next"],
  ["ArrowUp", "previous"],
  ["Enter", "reply"],
  ["Escape", "back"],
  [SHORTCUTS.open, "open"],
  [SHORTCUTS.read, "read"],
  [SHORTCUTS.unread, "unread"],
  ["j", "next"],
  ["k", "previous"],
  ["r", "reply"],
]);

const TEXT_FIELDS: ReadonlySet<string> = new Set(["INPUT", "SELECT", "TEXTAREA"]);

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || TEXT_FIELDS.has(target.tagName));
}

function isTaken(event: KeyboardEvent): boolean {
  return event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey;
}

function inboxKeyOf(event: KeyboardEvent): InboxKey | null {
  const key = KEYS.get(event.key) ?? null;
  if (isTaken(event) || (key !== "back" && isTextField(event.target))) {
    return null;
  }
  return key;
}

export { type InboxKey, SHORTCUTS, inboxKeyOf, isTextField };
