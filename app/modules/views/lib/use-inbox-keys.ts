import { SHORTCUTS, inboxKeyOf, isTextField } from "./inbox-keys.ts";
import type { InboxKey } from "./inbox-keys.ts";
import { hrefOf } from "../../paths/index.ts";
import { isNarrowWindow } from "./narrow-window.ts";
import { useEffect } from "react";

const ROWS = "a[data-feed-row]";
const INBOX_ROW = "#/inbox/";
const CONTROLS = "a, button";
const REPLY_BOX = "textarea";
const FIRST = 0;
const STEPS = { next: 1, previous: -1 } as const;
const NOT_FOUND = -1;

interface InboxKeys {
  readonly selected: boolean;
  readonly conversation: string;
}

interface KeyPress extends InboxKeys {
  readonly event: KeyboardEvent;
}

function rowAddresses(): readonly string[] {
  const addresses: string[] = [];
  for (const row of globalThis.document.querySelectorAll<HTMLAnchorElement>(ROWS)) {
    const href = row.hash;
    if (href.startsWith(INBOX_ROW) && !addresses.includes(href)) {
      addresses.push(href);
    }
  }
  return addresses;
}

function rowAt(address: string): HTMLElement | null {
  return globalThis.document.querySelector<HTMLElement>(`${ROWS}[href="${address}"]`);
}

function firstOf(key: "next" | "previous", addresses: readonly string[]): string | null {
  if (key === "previous") {
    return null;
  }
  return addresses[FIRST] ?? null;
}

function besideCurrent(key: "next" | "previous"): string | null {
  const addresses = rowAddresses();
  const at = addresses.indexOf(globalThis.location.hash);
  if (at === NOT_FOUND) {
    return firstOf(key, addresses);
  }
  return addresses[at + STEPS[key]] ?? null;
}

function select(key: "next" | "previous"): (keyPress: KeyPress) => void {
  return ({ event }) => {
    const address = besideCurrent(key);
    if (address === null) {
      return;
    }
    event.preventDefault();
    const row = rowAt(address);
    if (row !== null) {
      row.focus();
    }
    globalThis.location.hash = address;
  };
}

function inConversation(conversation: string, selector: string): HTMLElement | null {
  return globalThis.document.querySelector<HTMLElement>(`aside[aria-label="${conversation}"] ${selector}`);
}

function reply({ conversation, event }: KeyPress): void {
  const { target } = event;
  if (target instanceof HTMLElement && target.matches(CONTROLS) && !target.matches(ROWS)) {
    return;
  }
  const box = inConversation(conversation, REPLY_BOX);
  if (box !== null) {
    event.preventDefault();
    box.focus();
  }
}

function focusCurrentRow(): void {
  const row = rowAt(globalThis.location.hash);
  if (row !== null) {
    row.focus();
  }
}

function back({ event, selected }: KeyPress): void {
  const { target } = event;
  if (isTextField(target) && target instanceof HTMLElement) {
    event.preventDefault();
    target.blur();
    focusCurrentRow();
  } else if (selected && isNarrowWindow()) {
    event.preventDefault();
    globalThis.location.hash = hrefOf({ name: "inbox", selected: null });
  }
}

function shortcut(name: keyof typeof SHORTCUTS): (keyPress: KeyPress) => void {
  return ({ conversation, event }) => {
    const button = inConversation(conversation, `[aria-keyshortcuts="${SHORTCUTS[name]}"]`);
    if (button !== null) {
      event.preventDefault();
      button.click();
    }
  };
}

const ACTIONS: Readonly<Record<InboxKey, (keyPress: KeyPress) => void>> = {
  back,
  next: select("next"),
  open: shortcut("open"),
  previous: select("previous"),
  read: shortcut("read"),
  reply,
  unread: shortcut("unread"),
};

function useInboxKeys(keys: InboxKeys): void {
  const { conversation, selected } = keys;
  useEffect(() => {
    function pressed(event: KeyboardEvent): void {
      const key = inboxKeyOf(event);
      if (key !== null) {
        ACTIONS[key]({ conversation, event, selected });
      }
    }
    globalThis.document.addEventListener("keydown", pressed);
    return (): void => {
      globalThis.document.removeEventListener("keydown", pressed);
    };
  }, [conversation, selected]);
}

export { useInboxKeys };
