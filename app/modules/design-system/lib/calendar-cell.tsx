import type { CalendarCellParts } from "./picker-parts.ts";
import type { ReactNode } from "react";
import { useCallback } from "react";

const BASE =
  "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground max-md:h-10 max-md:w-10";
const TODAY = "font-semibold after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-current";
const IN_TAB_ORDER = 0;
const OUT_OF_TAB_ORDER = -1;

function lookOf(parts: CalendarCellParts): string {
  const { day, marks } = parts;
  if (day.day === marks.selected) {
    return "bg-foreground text-background";
  }
  if (!day.inMonth) {
    return "text-muted-foreground/60 hover:bg-accent";
  }
  return "text-foreground hover:bg-accent";
}

function markOf(parts: CalendarCellParts): string {
  if (parts.day.day === parts.marks.today) {
    return TODAY;
  }
  return "";
}

function tabOf(parts: CalendarCellParts): number {
  if (parts.day.day === parts.marks.focused) {
    return IN_TAB_ORDER;
  }
  return OUT_OF_TAB_ORDER;
}

export function CalendarCell(parts: CalendarCellParts): ReactNode {
  const { day, marks } = parts;
  const { onPick } = marks;
  const handleKey = marks.onKey;
  const handlePick = useCallback(() => {
    onPick(day.day);
  }, [day.day, onPick]);
  return (
    <td className="p-0.5">
      <button
        aria-current={day.day === marks.today && "date"}
        aria-label={day.spoken}
        aria-pressed={day.day === marks.selected}
        className={`${BASE} ${lookOf(parts)} ${markOf(parts)}`}
        data-day={day.day}
        onClick={handlePick}
        onKeyDown={handleKey}
        tabIndex={tabOf(parts)}
        type="button"
      >
        {day.number}
      </button>
    </td>
  );
}
