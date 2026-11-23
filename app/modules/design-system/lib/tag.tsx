import type { ReactNode } from "react";
import type { TagParts } from "./parts.ts";

export function Tag(parts: TagParts): ReactNode {
  return (
    <span className="rounded border px-1 py-px text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase">
      {parts.label}
    </span>
  );
}
