import type { ReactNode } from "react";
import type { TimeOptionParts } from "./picker-parts.ts";
import { useCallback } from "react";

const BASE =
  "flex shrink-0 cursor-pointer items-center rounded-md px-3 py-1.5 text-left text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground max-md:py-2.5 max-md:text-[15px]";
const IN_TAB_ORDER = 0;
const OUT_OF_TAB_ORDER = -1;

function lookOf(selected: boolean): string {
  if (selected) {
    return "bg-foreground text-background";
  }
  return "text-foreground hover:bg-accent focus:bg-accent";
}

function tabOf(first: boolean): number {
  if (first) {
    return IN_TAB_ORDER;
  }
  return OUT_OF_TAB_ORDER;
}

export function TimeOption(parts: TimeOptionParts): ReactNode {
  const { onPick, time } = parts;
  const handleKey = parts.onKey;
  const handlePick = useCallback(() => {
    onPick(time);
  }, [onPick, time]);
  return (
    <button
      aria-pressed={parts.selected}
      className={`${BASE} ${lookOf(parts.selected)}`}
      onClick={handlePick}
      onKeyDown={handleKey}
      tabIndex={tabOf(parts.first)}
      type="button"
    >
      {time}
    </button>
  );
}
