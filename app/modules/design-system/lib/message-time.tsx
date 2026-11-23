import type { ReactNode } from "react";
import type { ShownTimeParts } from "./parts.ts";
import { Tooltip } from "./tooltip.tsx";

const FOCUSABLE = 0;

function shownClass(hidden: boolean): string {
  if (hidden) {
    return "invisible pt-1 text-[10px] group-focus-within:visible group-hover:visible";
  }
  return "text-[11px]";
}

function linesOf(parts: ShownTimeParts): readonly string[] {
  if (parts.receipt === null) {
    return [parts.full];
  }
  return [parts.full, parts.receipt];
}

export function MessageTime(parts: ShownTimeParts): ReactNode {
  return (
    <Tooltip lines={linesOf(parts)}>
      <time
        className={`rounded-sm font-mono text-muted-foreground ${shownClass(parts.hidden)}`}
        dateTime={parts.iso}
        tabIndex={FOCUSABLE}
      >
        {parts.shown}
      </time>
    </Tooltip>
  );
}
