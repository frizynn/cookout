import type { MessageMenuParts } from "./menu-parts.ts";
import type { RefObject } from "react";
import { useEffect } from "react";
import { useReactionKeys } from "./use-reaction-keys.ts";

const INTERACTIVE =
  "a, button, input, select, textarea, summary, label, [role=button], [role=link], [role=menuitem], [tabindex], [contenteditable]";

function onItself(target: EventTarget | null, article: EventTarget | null): boolean {
  if (!(target instanceof Element) || !(article instanceof Element)) {
    return false;
  }
  const hit = target.closest(INTERACTIVE);
  return hit === null || hit === article || !article.contains(hit);
}

function altClickOnItself(event: MouseEvent): boolean {
  return event.altKey && onItself(event.target, event.currentTarget);
}

function pressed(event: MouseEvent): void {
  if (altClickOnItself(event)) {
    event.preventDefault();
  }
}

export function useMessageArticle(menu: MessageMenuParts): RefObject<HTMLElement | null> {
  const article = useReactionKeys(menu.reactions);
  const { onMarkUnread } = menu;
  useEffect(() => {
    const shown = article.current;
    function clicked(event: MouseEvent): void {
      if (altClickOnItself(event)) {
        event.preventDefault();
        onMarkUnread();
      }
    }
    function stop(): void {
      if (shown !== null) {
        shown.removeEventListener("mousedown", pressed);
        shown.removeEventListener("click", clicked);
      }
    }
    if (shown !== null) {
      shown.addEventListener("mousedown", pressed);
      shown.addEventListener("click", clicked);
    }
    return stop;
  }, [article, onMarkUnread]);
  return article;
}
