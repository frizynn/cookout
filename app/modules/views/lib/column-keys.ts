import type { Act } from "../../keymap/index.ts";
import { locationOf } from "../../paths/index.ts";

const SIDEBAR_LINK = 'nav[aria-label="Sidebar"] a[href]';
const OPEN_LINK = `${SIDEBAR_LINK}[aria-current="page"]`;
const FEED = '[role="feed"]';
const MESSAGE = "article";
const SELECTED = `${MESSAGE}[aria-current="true"]`;
const BOX = 'textarea[name="text"]';
const PANEL = "aside";
const LAST = -1;

type ColumnAction = "intoMessageBox" | "intoMessages" | "toSidebar";

interface ColumnKeys {
  readonly watch: (target: () => Element | null) => void;
}

function focusedOn(element: unknown): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  element.focus();
  return globalThis.document.activeElement === element;
}

function channelFeed(): HTMLElement | null {
  for (const feed of globalThis.document.querySelectorAll<HTMLElement>(`main ${FEED}`)) {
    if (feed.closest(PANEL) === null) {
      return feed;
    }
  }
  return null;
}

function holds(around: unknown, element: unknown): boolean {
  return around instanceof Node && element instanceof Node && around.contains(element);
}

function isMessage(target: unknown): target is HTMLElement {
  return target instanceof HTMLElement && target.matches(MESSAGE);
}

function inChannelFeed(target: unknown): boolean {
  return isMessage(target) && holds(channelFeed(), target);
}

function toSidebar({ target }: KeyboardEvent): boolean {
  return inChannelFeed(target) && focusedOn(globalThis.document.querySelector(OPEN_LINK));
}

function chosen(): unknown {
  const feed = channelFeed();
  if (feed === null) {
    return null;
  }
  return feed.querySelector(SELECTED) ?? [...feed.querySelectorAll(MESSAGE)].at(LAST);
}

function newestIn(channel: string): Element | null {
  const label = `[aria-label="${CSS.escape(`Messages in #${channel}`)}"]`;
  const feed = channelFeed();
  if (!(feed instanceof Element) || feed.closest(label) === null) {
    return null;
  }
  return [...feed.querySelectorAll(MESSAGE)].at(LAST) ?? null;
}

function channelOf(target: unknown): string | null {
  if (!(target instanceof HTMLAnchorElement) || !target.matches(SIDEBAR_LINK)) {
    return null;
  }
  const { route } = locationOf(target.hash);
  if (route.name !== "channel") {
    return null;
  }
  return route.channel;
}

function intoMessages(keys: ColumnKeys): Act {
  return ({ target }) => {
    const channel = channelOf(target);
    if (!(target instanceof HTMLAnchorElement) || channel === null) {
      return false;
    }
    if (target.matches(OPEN_LINK)) {
      return focusedOn(chosen());
    }
    target.blur();
    globalThis.location.hash = target.hash;
    keys.watch(() => newestIn(channel));
    return true;
  };
}

function columnOf(message: unknown): Element | null {
  if (!(message instanceof Element)) {
    return null;
  }
  return message.closest(PANEL) ?? channelFeed();
}

function outsidePanel(element: unknown): boolean {
  return element instanceof Element && element.closest(PANEL) === null;
}

function boxOf(column: unknown): unknown {
  if (!(column instanceof Element)) {
    return null;
  }
  if (column.matches(PANEL)) {
    return column.querySelector(BOX);
  }
  for (const box of globalThis.document.querySelectorAll(`main ${BOX}`)) {
    if (outsidePanel(box)) {
      return box;
    }
  }
  return null;
}

function intoMessageBox({ target }: KeyboardEvent): boolean {
  const column = columnOf(target);
  return (
    isMessage(target) &&
    column !== null &&
    [...column.querySelectorAll(MESSAGE)].at(LAST) === target &&
    focusedOn(boxOf(column))
  );
}

function columnActions(keys: Readonly<ColumnKeys>): Readonly<Record<ColumnAction, Act>> {
  return { intoMessageBox, intoMessages: intoMessages(keys), toSidebar };
}

export { columnActions };
