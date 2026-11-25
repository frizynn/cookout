import type { Act, Action, Keymap } from "../../keymap/index.ts";
import { THREAD_PANEL } from "./thread-panel.ts";

const MESSAGE = "article";
const PANEL = `aside[aria-label="${THREAD_PANEL.thread}"]`;
const PANEL_PARENT = `${PANEL} article[aria-label="${THREAD_PANEL.parent}"]`;
const PANEL_REPLY_BOX = `${PANEL} textarea`;
const PANEL_CLOSE = `${PANEL} > header a[href]`;
const CHANNEL_MESSAGE = `main [role="feed"] ${MESSAGE}[aria-current="true"]`;

interface Pressing {
  readonly keymap: Keymap;
  readonly action: Action;
  readonly whenOpen: string;
}

function focused(selector: string): boolean {
  const element = globalThis.document.querySelector<HTMLElement>(selector);
  if (element === null) {
    return false;
  }
  element.focus();
  return true;
}

type MessageOf = (target: EventTarget | null) => Element | null;

interface Clicking {
  readonly keymap: Keymap;
  readonly action: Action;
  readonly messageOf: MessageOf;
}

interface ControlOf {
  readonly target: EventTarget | null;
  readonly keys: string;
  readonly message: MessageOf;
}

function focusedMessage(target: EventTarget | null): Element | null {
  if (!(target instanceof HTMLElement) || !target.matches(MESSAGE)) {
    return null;
  }
  return target;
}

function controlFor({ keys, message, target }: ControlOf): HTMLElement | null {
  const found = message(target);
  if (found === null) {
    return null;
  }
  return found.querySelector<HTMLElement>(`[aria-keyshortcuts="${keys}"]`);
}

function clickOn({ action, keymap, messageOf }: Clicking): Act {
  return ({ target }) => {
    const { keys } = keymap.shortcutOf(action);
    const control = controlFor({ keys, message: messageOf, target });
    if (control === null) {
      return false;
    }
    control.click();
    return true;
  };
}

function click(keymap: Keymap, action: Action): Act {
  return clickOn({ action, keymap, messageOf: focusedMessage });
}

function press({ action, keymap, whenOpen }: Pressing): Act {
  return ({ target }) => {
    const control = controlFor({ keys: keymap.shortcutOf(action).keys, message: focusedMessage, target });
    if (control === null) {
      return false;
    }
    if (control instanceof HTMLAnchorElement && control.hash === globalThis.location.hash) {
      return focused(whenOpen);
    }
    control.click();
    return true;
  };
}

function inPanel(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches(MESSAGE) && target.closest(PANEL) !== null;
}

function backToChannel({ target }: KeyboardEvent): boolean {
  return inPanel(target) && focused(CHANNEL_MESSAGE);
}

function threadPanel(): Element | null {
  return globalThis.document.querySelector(PANEL);
}

function closedTo(hash: string): boolean {
  focused(CHANNEL_MESSAGE);
  globalThis.location.hash = hash;
  return true;
}

function closeThread(): boolean {
  const close = globalThis.document.querySelector<HTMLAnchorElement>(PANEL_CLOSE);
  return close !== null && closedTo(close.hash);
}

type MessageAction =
  | "backToChannel"
  | "copyMessageLink"
  | "markUnread"
  | "openThread"
  | "replyToMessage"
  | "toggleThreadClosed"
  | "toggleThumbsDown"
  | "toggleThumbsUp";

function messageActions(keymap: Keymap): Readonly<Record<MessageAction, Act>> {
  return {
    backToChannel,
    copyMessageLink: click(keymap, "copyMessageLink"),
    markUnread: click(keymap, "markUnread"),
    openThread: press({ action: "openThread", keymap, whenOpen: PANEL_PARENT }),
    replyToMessage: press({ action: "replyToMessage", keymap, whenOpen: PANEL_REPLY_BOX }),
    toggleThreadClosed: click(keymap, "toggleThreadClosed"),
    toggleThumbsDown: click(keymap, "toggleThumbsDown"),
    toggleThumbsUp: click(keymap, "toggleThumbsUp"),
  };
}

export { clickOn, closeThread, messageActions, threadPanel };
