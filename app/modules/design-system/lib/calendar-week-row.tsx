import { CalendarCell } from "./calendar-cell.tsx";
import type { CalendarWeekParts } from "./picker-parts.ts";
import type { ReactNode } from "react";

export function CalendarWeekRow(parts: CalendarWeekParts): ReactNode {
  return (
    <tr>
      {parts.week.days.map((day) => (
        <CalendarCell day={day} key={day.day} marks={parts.marks} />
      ))}
    </tr>
  );
}
