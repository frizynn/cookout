import { MenuIconFrame } from "./menu-icon-frame.tsx";
import type { ReactNode } from "react";

interface CalendarStepParts {
  readonly label: string;
  readonly way: "back" | "on";
  readonly onStep: () => void;
}

function pathOf(way: CalendarStepParts["way"]): string {
  if (way === "back") {
    return "M10 4l-4 4 4 4";
  }
  return "M6 4l4 4-4 4";
}

export function CalendarStep(parts: CalendarStepParts): ReactNode {
  const handleStep = parts.onStep;
  return (
    <button
      aria-label={parts.label}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-muted-foreground max-md:h-10 max-md:w-10"
      onClick={handleStep}
      type="button"
    >
      <MenuIconFrame>
        <path d={pathOf(parts.way)} />
      </MenuIconFrame>
    </button>
  );
}
