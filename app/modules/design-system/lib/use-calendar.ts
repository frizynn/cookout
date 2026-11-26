import type { CalendarMarks, CalendarParts } from "./picker-parts.ts";
import type { KeyboardEvent, RefObject } from "react";
import { calendarMonth, monthOf, shiftDays, shiftMonths } from "../../format/index.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarMonth } from "../../format/index.ts";

interface Focus {
  readonly day: string;
  readonly moved: boolean;
}

interface CalendarState {
  readonly grid: RefObject<HTMLTableElement | null>;
  readonly month: CalendarMonth;
  readonly marks: CalendarMarks;
  readonly handlePrevious: () => void;
  readonly handleNext: () => void;
}

const DAY = 1;
const WEEK = 7;
const MONTH = 1;

const MOVES: Readonly<Partial<Record<string, (day: string) => string>>> = {
  ArrowDown: (day) => shiftDays({ by: WEEK, day }),
  ArrowLeft: (day) => shiftDays({ by: -DAY, day }),
  ArrowRight: (day) => shiftDays({ by: DAY, day }),
  ArrowUp: (day) => shiftDays({ by: -WEEK, day }),
  PageDown: (day) => shiftMonths({ by: MONTH, day }),
  PageUp: (day) => shiftMonths({ by: -MONTH, day }),
};

function startOf(parts: CalendarParts): Focus {
  if (parts.selected === "") {
    return { day: parts.today, moved: false };
  }
  return { day: parts.selected, moved: false };
}

function focusDay(table: unknown, focus: Focus): void {
  if (!(table instanceof HTMLTableElement) || !focus.moved) {
    return;
  }
  const button = table.querySelector<HTMLButtonElement>(`[data-day="${focus.day}"]`);
  if (button !== null) {
    button.focus();
  }
}

function useStep(setFocus: (step: (focus: Focus) => Focus) => void, by: number): () => void {
  return useCallback(() => {
    setFocus((focus) => ({ day: shiftMonths({ by, day: focus.day }), moved: false }));
  }, [by, setFocus]);
}

function useCalendar(parts: CalendarParts): CalendarState {
  const { onPick, selected, today } = parts;
  const [focus, setFocus] = useState(() => startOf(parts));
  const grid = useRef<HTMLTableElement>(null);
  useEffect(() => {
    focusDay(grid.current, focus);
  }, [focus]);
  const handleKey = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    const move = MOVES[event.key] ?? null;
    if (move !== null) {
      event.preventDefault();
      setFocus((current) => ({ day: move(current.day), moved: true }));
    }
  }, []);
  const marks = useMemo(
    () => ({ focused: focus.day, onKey: handleKey, onPick, selected, today }),
    [focus.day, handleKey, onPick, selected, today],
  );
  const month = useMemo(() => calendarMonth(monthOf(focus.day)), [focus.day]);
  return { grid, handleNext: useStep(setFocus, MONTH), handlePrevious: useStep(setFocus, -MONTH), marks, month };
}

export { useCalendar };
