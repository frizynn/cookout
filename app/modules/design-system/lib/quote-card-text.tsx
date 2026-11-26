import type { QuoteCardParts } from "./quote-card-parts.ts";
import type { ReactNode } from "react";

export function QuoteCardText(
  parts: Pick<QuoteCardParts, "author" | "children" | "fullTime" | "time" | "where">,
): ReactNode {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate font-semibold">{parts.author}</span>
        <time className="shrink-0 text-xs text-muted-foreground" title={parts.fullTime}>
          {parts.time}
        </time>
      </span>
      <span className="text-xs text-muted-foreground">{parts.where}</span>
      <span className="mt-1 line-clamp-3 text-sm break-words whitespace-pre-line">{parts.children}</span>
    </span>
  );
}
