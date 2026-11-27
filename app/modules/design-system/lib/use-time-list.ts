import type { KeyboardEvent } from "react";
import { useListKeys } from "./use-list-keys.ts";

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

function firstOf(selected: string): string {
  if (selected === "") {
    return MORNING;
  }
  return TIMES.find((time) => time >= selected) ?? MORNING;
}

function useTimeList(selected: string): TimeListState {
  const handleKey = useListKeys();
  return { first: firstOf(selected), handleKey };
}

export { TIMES, useTimeList };
