import type { ReactNode } from "react";
import type { ShownTimeParts } from "./parts.ts";

function shownClass(hidden: boolean): string {
  if (hidden) {
    return "invisible pt-1 text-[10px] group-focus-within:visible group-hover:visible";
  }
  return "text-[11px]";
}

export function MessageTime(parts: ShownTimeParts): ReactNode {
  return (
    <time
      className={`font-mono text-muted-foreground ${shownClass(parts.hidden)}`}
      dateTime={parts.iso}
      title={parts.full}
    >
      {parts.short}
    </time>
  );
}
