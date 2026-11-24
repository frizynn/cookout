import type { Search, SearchState } from "../../search/web.ts";
import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { SearchResult } from "../../sdk/index.ts";
import { hrefOf } from "../../paths/index.ts";

const SHORTCUT = "k";
const NEAR_END_PX = 48;
const CAPTURE = { capture: true } as const;

interface SearchBox {
  readonly area: RefObject<HTMLDivElement | null>;
  readonly box: RefObject<HTMLInputElement | null>;
  readonly handleChange: () => void;
}

interface Place {
  readonly search: Search;
  readonly area: () => HTMLDivElement | null;
  readonly box: () => HTMLInputElement | null;
  readonly back: () => Element | null;
  readonly remember: () => void;
  readonly forget: () => void;
}

type Listener = (event: Readonly<Event>) => void;

function searchHrefOf({ message }: SearchResult): string {
  if (message.kind === "reply") {
    return hrefOf({ channel: message.channel, message: message.id, name: "thread", thread: message.replyTo });
  }
  return hrefOf({ channel: message.channel, name: "thread", thread: message.id });
}

function highlightedOf(state: SearchState): SearchResult | null {
  if (state.found.status !== "found" || state.highlighted === null) {
    return null;
  }
  return state.found.results.at(state.highlighted) ?? null;
}

function isShortcut(event: Readonly<Event>): boolean {
  return (
    event instanceof KeyboardEvent &&
    event.key.toLowerCase() === SHORTCUT &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey
  );
}

function isInside(place: Place, event: Readonly<Event>): boolean {
  const area = place.area();
  return area !== null && event.target instanceof Node && area.contains(event.target);
}

function goBack(place: Place): void {
  const before = place.back();
  place.forget();
  if (before instanceof HTMLElement && before.isConnected && before !== globalThis.document.body) {
    before.focus();
    return;
  }
  const box = place.box();
  if (box !== null) {
    box.blur();
  }
}

function choose(place: Place): void {
  const chosen = highlightedOf(place.search.snapshot());
  if (chosen !== null) {
    place.search.close();
    place.forget();
    globalThis.location.hash = searchHrefOf(chosen);
  }
}

function boxKeys(place: Place): Readonly<Partial<Record<string, () => void>>> {
  const { search } = place;
  return {
    ArrowDown: () => {
      search.move("down");
    },
    ArrowUp: () => {
      search.move("up");
    },
    Enter: () => {
      choose(place);
    },
    Escape: () => {
      search.close();
      goBack(place);
    },
  };
}

function shortcutOf(place: Place): Listener {
  return (event) => {
    const box = place.box();
    if (box !== null && isShortcut(event)) {
      event.preventDefault();
      box.focus();
      box.select();
      place.search.open();
    }
  };
}

function keyOf(event: Readonly<Event>): string | null {
  if (!(event instanceof KeyboardEvent) || event.isComposing) {
    return null;
  }
  return event.key;
}

function pressedOf(place: Place): Listener {
  const keys = boxKeys(place);
  return (event) => {
    const action = keys[keyOf(event) ?? ""] ?? null;
    if (action !== null && event.target === place.box()) {
      event.preventDefault();
      action();
    }
  };
}

function focusedOf(place: Place): Listener {
  return (event) => {
    if (event.target === place.box()) {
      place.search.open();
      return;
    }
    if (!isInside(place, event)) {
      place.remember();
      place.search.close();
    }
  };
}

function pointedOf(place: Place): Listener {
  return (event) => {
    if (!isInside(place, event)) {
      place.search.close();
    }
  };
}

function clickedOf(place: Place): Listener {
  return (event) => {
    if (isInside(place, event) && event.target instanceof Element && event.target.closest("a") !== null) {
      place.search.close();
      place.forget();
    }
  };
}

function scrolledOf(place: Place): Listener {
  return (event) => {
    const list = event.target;
    const nearEnd =
      list instanceof HTMLElement && list.scrollTop + list.clientHeight >= list.scrollHeight - NEAR_END_PX;
    if (nearEnd && isInside(place, event)) {
      place.search.loadMore();
    }
  };
}

function listen(place: Place): () => void {
  const listening: readonly (readonly [string, Listener])[] = [
    ["keydown", shortcutOf(place)],
    ["keydown", pressedOf(place)],
    ["focusin", focusedOf(place)],
    ["pointerdown", pointedOf(place)],
    ["click", clickedOf(place)],
    ["scroll", scrolledOf(place)],
  ];
  for (const [type, listener] of listening) {
    globalThis.document.addEventListener(type, listener, CAPTURE);
  }
  return () => {
    for (const [type, listener] of listening) {
      globalThis.document.removeEventListener(type, listener, CAPTURE);
    }
  };
}

function useSearchBox(search: Search): SearchBox {
  const area = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const back = useRef<Element>(null);
  useEffect(
    () =>
      listen({
        area: () => area.current,
        back: () => back.current,
        box: () => box.current,
        forget: () => {
          back.current = null;
        },
        remember: () => {
          back.current = globalThis.document.activeElement;
        },
        search,
      }),
    [search],
  );
  const handleChange = useCallback(() => {
    if (box.current !== null) {
      search.edit(box.current.value);
    }
  }, [search]);
  return { area, box, handleChange };
}

export { highlightedOf, searchHrefOf, useSearchBox };
