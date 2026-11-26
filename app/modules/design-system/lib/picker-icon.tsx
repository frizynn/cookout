import { CalendarIcon } from "./calendar-icon.tsx";
import { ClockIcon } from "./clock-icon.tsx";
import type { PickerKind } from "./picker-parts.ts";
import type { ReactNode } from "react";

interface PickerIconParts {
  readonly kind: PickerKind;
}

export function PickerIcon(parts: PickerIconParts): ReactNode {
  return (
    <span className="flex text-muted-foreground">
      {parts.kind === "date" && <CalendarIcon />}
      {parts.kind === "time" && <ClockIcon />}
    </span>
  );
}
