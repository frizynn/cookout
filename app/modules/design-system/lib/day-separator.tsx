import type { ReactNode } from "react";
import type { SeparatorParts } from "./parts.ts";

export function DaySeparator(parts: SeparatorParts): ReactNode {
  return (
    <div className="my-3 flex items-center px-5">
      <hr aria-label={parts.label} className="h-px flex-1 border-0 bg-border" />
      <span
        aria-hidden="true"
        className="mx-3 rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
      >
        {parts.label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
