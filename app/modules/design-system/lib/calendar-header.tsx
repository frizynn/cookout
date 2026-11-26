import type { CalendarHeaderParts } from "./picker-parts.ts";
import { CalendarSteps } from "./calendar-steps.tsx";
import type { ReactNode } from "react";

export function CalendarHeader(parts: CalendarHeaderParts): ReactNode {
  const handlePrevious = parts.onPrevious;
  const handleNext = parts.onNext;
  return (
    <caption>
      <span className="flex items-center justify-between gap-2 pb-1 pl-2">
        <span aria-live="polite" className="text-sm font-semibold text-foreground" id={parts.title}>
          {parts.label}
        </span>
        <CalendarSteps onNext={handleNext} onPrevious={handlePrevious} />
      </span>
    </caption>
  );
}
