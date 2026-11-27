import type { ReactNode } from "react";
import type { ShownTimeParts } from "./parts.ts";
import { Tooltip } from "./tooltip.tsx";

const FOCUSABLE = 0;

function shownClass(inGutter: boolean): string {
  if (inGutter) {
    return "pt-1 text-[10px]";
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
        className={`shrink-0 rounded-sm whitespace-nowrap tabular-nums text-muted-foreground ${shownClass(parts.inGutter)}`}
        dateTime={parts.iso}
        tabIndex={FOCUSABLE}
      >
        {parts.shown}
      </time>
    </Tooltip>
  );
}
