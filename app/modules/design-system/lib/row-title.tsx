import type { ReactNode } from "react";
import type { RowTitleParts } from "./parts.ts";

const MARKED = "font-semibold text-foreground";
const SEEN = "text-muted-foreground";

function titleStyle(marked: boolean): string {
  if (marked) {
    return MARKED;
  }
  return SEEN;
}

export function RowTitle(parts: RowTitleParts): ReactNode {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={titleStyle(parts.marked)}>{parts.title}</span>
      {parts.children}
    </span>
  );
}
