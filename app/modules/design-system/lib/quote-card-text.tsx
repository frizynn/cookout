import { Avatar } from "./avatar.tsx";
import type { QuoteCardParts } from "./quote-card-parts.ts";
import type { ReactNode } from "react";

export function QuoteCardText(parts: Omit<QuoteCardParts, "href">): ReactNode {
  return (
    <>
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <Avatar agent={parts.agent} name={parts.name} presence={null} size="inline" />
        <span className="max-w-full truncate font-semibold text-foreground">{parts.author}</span>
        <span className="whitespace-nowrap">{parts.where}</span>
        <time className="whitespace-nowrap" title={parts.fullTime}>
          {parts.time}
        </time>
      </span>
      <span className="line-clamp-3 text-sm break-words whitespace-pre-line text-muted-foreground">
        {parts.children}
      </span>
    </>
  );
}
