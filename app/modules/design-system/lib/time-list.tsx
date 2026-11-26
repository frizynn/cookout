import { TIMES, useTimeList } from "./use-time-list.ts";
import type { ReactNode } from "react";
import type { TimeListParts } from "./picker-parts.ts";
import { TimeOption } from "./time-option.tsx";

export function TimeList(parts: TimeListParts): ReactNode {
  const { first, handleKey } = useTimeList(parts.selected);
  const handlePick = parts.onPick;
  return (
    <div className="flex max-h-64 w-36 flex-col gap-0.5 overflow-y-auto overscroll-contain max-md:max-h-72">
      {TIMES.map((time) => (
        <TimeOption
          first={time === first}
          key={time}
          onKey={handleKey}
          onPick={handlePick}
          selected={time === parts.selected}
          time={time}
        />
      ))}
    </div>
  );
}
