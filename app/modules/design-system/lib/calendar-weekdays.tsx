import type { ReactNode } from "react";

const WEEKDAYS = [
  { full: "Monday", short: "Mo" },
  { full: "Tuesday", short: "Tu" },
  { full: "Wednesday", short: "We" },
  { full: "Thursday", short: "Th" },
  { full: "Friday", short: "Fr" },
  { full: "Saturday", short: "Sa" },
  { full: "Sunday", short: "Su" },
] as const;

export function CalendarWeekdays(): ReactNode {
  return (
    <thead>
      <tr>
        {WEEKDAYS.map((weekday) => (
          <th
            abbr={weekday.full}
            className="h-8 text-center text-xs font-normal text-muted-foreground"
            key={weekday.full}
            scope="col"
          >
            {weekday.short}
          </th>
        ))}
      </tr>
    </thead>
  );
}
