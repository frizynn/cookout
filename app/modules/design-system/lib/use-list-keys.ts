import type { KeyboardEvent } from "react";
import { useCallback } from "react";

const FIRST = 0;
const ONE = 1;

const MOVES: Readonly<Partial<Record<string, (index: number, last: number) => number>>> = {
  ArrowDown: (index, last) => Math.min(index + ONE, last),
  ArrowUp: (index) => Math.max(index - ONE, FIRST),
  End: (_index, last) => last,
  Home: () => FIRST,
};

function focusNext(button: unknown, move: (index: number, last: number) => number): void {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  const buttons = [...(button.parentElement ?? button).children];
  const next = buttons[move(buttons.indexOf(button), buttons.length - ONE)];
  if (next instanceof HTMLElement) {
    next.focus();
  }
}

function focusMoved(button: unknown, key: string): boolean {
  const move = MOVES[key] ?? null;
  if (move === null) {
    return false;
  }
  focusNext(button, move);
  return true;
}

function useListKeys(): (event: KeyboardEvent<HTMLButtonElement>) => void {
  return useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (focusMoved(event.currentTarget, event.key)) {
      event.preventDefault();
    }
  }, []);
}

export { useListKeys };
