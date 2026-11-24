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

interface Press {
  readonly key: string;
  readonly shortcut: boolean;
}

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

function pressOf(event: Readonly<Event>): Press {
  if (!(event instanceof KeyboardEvent) || event.isComposing) {
    return { key: "", shortcut: false };
  }
  return { key: event.key, shortcut: isShortcut(event) };
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
    if (box !== null && pressOf(event).shortcut) {
      event.preventDefault();
      box.focus();
      box.select();
      place.search.open();
    }
  };
}

function pressedOf(place: Place): Listener {
  const keys = boxKeys(place);
  return (event) => {
    const action = keys[pressOf(event).key] ?? null;
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

function on<Type extends keyof DocumentEventMap>(
  type: Type,
  listener: (event: Readonly<DocumentEventMap[Type]>) => void,
): () => void {
  globalThis.document.addEventListener(type, listener, CAPTURE);
  return () => {
    globalThis.document.removeEventListener(type, listener, CAPTURE);
  };
}

function listen(place: Place): () => void {
  const stops = [
    on("keydown", shortcutOf(place)),
    on("keydown", pressedOf(place)),
    on("focusin", focusedOf(place)),
    on("pointerdown", pointedOf(place)),
    on("click", clickedOf(place)),
    on("scroll", scrolledOf(place)),
  ];
  return () => {
    for (const stop of stops) {
      stop();
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
