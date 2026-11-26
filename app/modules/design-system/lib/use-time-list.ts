import type { KeyboardEvent } from "react";
import { useCallback } from "react";

interface TimeListState {
  readonly first: string;
  readonly handleKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

const STEP = 15;
const HOURS = 24;
const HOUR = 60;
const WIDTH = 2;
const MORNING = "09:00";

const TIMES: readonly string[] = Array.from({ length: (HOURS * HOUR) / STEP }, (_unused, index) => {
  const minutes = index * STEP;
  const hour = String(Math.floor(minutes / HOUR)).padStart(WIDTH, "0");
  return `${hour}:${String(minutes % HOUR).padStart(WIDTH, "0")}`;
});

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

function focusTime(button: unknown, key: string): boolean {
  const move = MOVES[key] ?? null;
  if (move === null) {
    return false;
  }
  focusNext(button, move);
  return true;
}

function firstOf(selected: string): string {
  if (selected === "") {
    return MORNING;
  }
  return TIMES.find((time) => time >= selected) ?? MORNING;
}

function useTimeList(selected: string): TimeListState {
  const handleKey = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (focusTime(event.currentTarget, event.key)) {
      event.preventDefault();
    }
  }, []);
  return { first: firstOf(selected), handleKey };
}

export { TIMES, useTimeList };
