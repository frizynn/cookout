import { useEffect, useRef } from "react";
import type { ReactionChoice } from "./menu-parts.ts";
import type { RefObject } from "react";

function pressedOnItself(event: KeyboardEvent): boolean {
  return event.target === event.currentTarget && !event.ctrlKey && !event.metaKey && !event.altKey;
}

export function useReactionKeys(choices: readonly ReactionChoice[]): RefObject<HTMLElement | null> {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    const shown = element.current;
    function pressed(event: KeyboardEvent): void {
      const choice = choices.find((each) => each.key === event.key) ?? null;
      if (choice !== null && pressedOnItself(event)) {
        event.preventDefault();
        choice.onReact();
      }
    }
    function stop(): void {
      if (shown !== null) {
        shown.removeEventListener("keydown", pressed);
      }
    }
    if (shown !== null) {
      shown.addEventListener("keydown", pressed);
    }
    return stop;
  }, [choices]);
  return element;
}
