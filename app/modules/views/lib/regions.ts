import type { Act } from "../../keymap/index.ts";

const SIDEBAR = 'nav[aria-label="Sidebar"]';
const FEED = 'main [role="feed"]';
const MESSAGES = "section[aria-label]";
const PANEL = "main aside";
const MESSAGE_BOX = "main form";
const ENTRIES = [
  'article[tabindex="0"], a[tabindex="0"]',
  "textarea",
  'a[href], button, input, select, [tabindex]:not([tabindex="-1"])',
] as const;
const STEPS = { next: 1, previous: -1 } as const;
const ENDS = { next: 0, previous: -1 } as const;
const NOT_FOUND = -1;
const NONE = 0;

type Step = keyof typeof STEPS;

interface RegionKeys {
  readonly remember: (target: unknown) => void;
  readonly actions: Readonly<Record<"nextRegion" | "previousRegion", Act>>;
}

function outsidePanel(selector: string): Element | null {
  for (const each of globalThis.document.querySelectorAll(selector)) {
    if (each.closest("aside") === null) {
      return each;
    }
  }
  return null;
}

function messagesRegion(): Element | null {
  const feed = outsidePanel(FEED);
  if (feed === null) {
    return null;
  }
  return feed.closest(MESSAGES) ?? feed;
}

function isShown(element: unknown): element is HTMLElement {
  return element instanceof HTMLElement && element.getClientRects().length > NONE;
}

function regionsShown(): readonly HTMLElement[] {
  const { document } = globalThis;
  const shown: HTMLElement[] = [];
  for (const region of [
    document.querySelector(SIDEBAR),
    messagesRegion(),
    document.querySelector(PANEL),
    outsidePanel(MESSAGE_BOX),
  ]) {
    if (isShown(region)) {
      shown.push(region);
    }
  }
  return shown;
}

function focusedOn(element: unknown): boolean {
  if (!(element instanceof HTMLElement) || !element.isConnected) {
    return false;
  }
  element.focus();
  return globalThis.document.activeElement === element;
}

function holds(region: unknown, element: unknown): boolean {
  return region instanceof Node && element instanceof Node && region.contains(element);
}

function focusedEntry(region: unknown): boolean {
  if (!(region instanceof Element)) {
    return false;
  }
  for (const entry of ENTRIES) {
    for (const element of region.querySelectorAll(entry)) {
      if (focusedOn(element)) {
        return true;
      }
    }
  }
  return false;
}

interface Entering {
  readonly region: unknown;
  readonly last: unknown;
}

function entered({ last, region }: Entering): boolean {
  return (holds(region, last) && focusedOn(last)) || focusedEntry(region);
}

interface Moving {
  readonly regions: readonly unknown[];
  readonly target: unknown;
  readonly step: Step;
}

function indexHolding({ regions, target }: Omit<Moving, "step">): number {
  let at = NOT_FOUND;
  for (const [index, region] of regions.entries()) {
    if (holds(region, target)) {
      at = index;
    }
  }
  return at;
}

function beside(moving: Moving): unknown {
  const { regions, step } = moving;
  const at = indexHolding(moving);
  if (at === NOT_FOUND) {
    return regions.at(ENDS[step]);
  }
  return regions.at((at + STEPS[step]) % regions.length);
}

function createRegionKeys(): RegionKeys {
  const last = new WeakMap<HTMLElement, HTMLElement>();
  function move(step: Step): Act {
    return ({ target }) => {
      const region = beside({ regions: regionsShown(), step, target });
      return region instanceof HTMLElement && entered({ last: last.get(region), region });
    };
  }
  return {
    actions: { nextRegion: move("next"), previousRegion: move("previous") },
    remember: (target) => {
      if (!(target instanceof HTMLElement)) {
        return;
      }
      for (const region of regionsShown()) {
        if (holds(region, target)) {
          last.set(region, target);
        }
      }
    },
  };
}

export { createRegionKeys };
