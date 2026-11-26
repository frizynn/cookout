import { CalendarWeekRow } from "./calendar-week-row.tsx";
import type { CalendarWeeksParts } from "./picker-parts.ts";
import type { ReactNode } from "react";

export function CalendarWeeks(parts: CalendarWeeksParts): ReactNode {
  return (
    <tbody>
      {parts.month.weeks.map((week) => (
        <CalendarWeekRow key={week.start} marks={parts.marks} week={week} />
      ))}
    </tbody>
  );
}
