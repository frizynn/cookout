import type { Act } from "../../keymap/index.ts";

const SIDEBAR = "Sidebar";
const LINKS = "a[href]";
const CURRENT = '[aria-current="page"]';
const ROW_BUTTONS = "li button";
const IN_TAB_ORDER = 0;
const OUT_OF_TAB_ORDER = -1;
const NOT_FOUND = -1;
const FIRST = 0;
const STEPS = { next: 1, previous: -1 } as const;

type Within = () => Element | null;

type Chosen = () => Element | null;

function sidebar(): Element | null {
  return globalThis.document.querySelector(`nav[aria-label="${SIDEBAR}"]`);
}

function linksIn(within: Within): readonly HTMLAnchorElement[] {
  const nav = within();
  if (nav === null) {
    return [];
  }
  return [...nav.querySelectorAll<HTMLAnchorElement>(LINKS)];
}

function rowButtonsIn(within: Within): readonly HTMLElement[] {
  const nav = within();
  if (nav === null) {
    return [];
  }
  return [...nav.querySelectorAll<HTMLElement>(ROW_BUTTONS)];
}

function currentIn(within: Within): Element | null {
  const nav = within();
  if (nav === null) {
    return null;
  }
  return nav.querySelector(`${LINKS}${CURRENT}`);
}

function stopIn(within: Within, chosen: Chosen): Element | null {
  const links = linksIn(within);
  const picked = chosen();
  for (const link of links) {
    if (link === picked) {
      return link;
    }
  }
  return currentIn(within) ?? links[FIRST] ?? null;
}

function tabIndexOf(stop: boolean): number {
  if (stop) {
    return IN_TAB_ORDER;
  }
  return OUT_OF_TAB_ORDER;
}

function rove(within: Within, chosen: Chosen): void {
  const stop = stopIn(within, chosen);
  for (const link of linksIn(within)) {
    link.tabIndex = tabIndexOf(link === stop);
  }
  for (const button of rowButtonsIn(within)) {
    button.tabIndex = OUT_OF_TAB_ORDER;
  }
}

function focusedLink(within: Within): Element | null {
  const active = globalThis.document.activeElement;
  for (const link of linksIn(within)) {
    if (link === active) {
      return link;
    }
  }
  return null;
}

function watching(within: Within, changed: () => void): () => void {
  const observer = new MutationObserver(changed);
  const nav = within();
  if (nav !== null) {
    observer.observe(nav, { attributeFilter: ["aria-current", "href"], childList: true, subtree: true });
    nav.addEventListener("focusin", changed);
  }
  return () => {
    observer.disconnect();
    if (nav !== null) {
      nav.removeEventListener("focusin", changed);
    }
  };
}

function roving(within: Within): () => void {
  let chosen: Element | null = null;
  function picked(): Element | null {
    return chosen;
  }
  function changed(): void {
    chosen = focusedLink(within) ?? chosen;
    rove(within, picked);
  }
  changed();
  return watching(within, changed);
}

function focusedAt(within: Within): number {
  const active = globalThis.document.activeElement;
  let at = NOT_FOUND;
  for (const [index, link] of linksIn(within).entries()) {
    if (link === active) {
      at = index;
    }
  }
  return at;
}

function moveFocus({ step, within }: { readonly step: keyof typeof STEPS; readonly within: Within }): Act {
  return () => {
    const at = focusedAt(within);
    if (at === NOT_FOUND) {
      return false;
    }
    const next = linksIn(within)[at + STEPS[step]] ?? null;
    if (next !== null) {
      next.focus();
    }
    return true;
  };
}

export { SIDEBAR, moveFocus, roving, sidebar };
