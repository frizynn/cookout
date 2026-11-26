import { CalendarStep } from "./calendar-step.tsx";
import type { CalendarStepsParts } from "./picker-parts.ts";
import type { ReactNode } from "react";

const TEXT = { next: "Next month", previous: "Previous month" } as const;

export function CalendarSteps(parts: CalendarStepsParts): ReactNode {
  const handlePrevious = parts.onPrevious;
  const handleNext = parts.onNext;
  return (
    <span className="flex gap-0.5">
      <CalendarStep label={TEXT.previous} onStep={handlePrevious} way="back" />
      <CalendarStep label={TEXT.next} onStep={handleNext} way="on" />
    </span>
  );
}
