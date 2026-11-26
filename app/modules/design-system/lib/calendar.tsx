import { CalendarHeader } from "./calendar-header.tsx";
import type { CalendarParts } from "./picker-parts.ts";
import { CalendarWeekdays } from "./calendar-weekdays.tsx";
import { CalendarWeeks } from "./calendar-weeks.tsx";
import type { ReactNode } from "react";
import { useCalendar } from "./use-calendar.ts";
import { useId } from "react";

export function Calendar(parts: CalendarParts): ReactNode {
  const { grid, handleNext, handlePrevious, marks, month } = useCalendar(parts);
  const title = useId();
  return (
    <table aria-labelledby={title} className="border-collapse" ref={grid}>
      <CalendarHeader label={month.label} onNext={handleNext} onPrevious={handlePrevious} title={title} />
      <CalendarWeekdays />
      <CalendarWeeks marks={marks} month={month} />
    </table>
  );
}
