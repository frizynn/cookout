import type { QuoteCardParts } from "./quote-card-parts.ts";
import { QuoteCardText } from "./quote-card-text.tsx";
import type { ReactNode } from "react";

export function QuoteCard(parts: QuoteCardParts): ReactNode {
  return (
    <a
      className="mt-1.5 flex w-full max-w-xl flex-col gap-0.5 rounded-r-md border-l-[3px] border-muted-foreground/30 py-1 pr-2 pl-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent"
      href={parts.href}
    >
      <QuoteCardText
        agent={parts.agent}
        author={parts.author}
        fullTime={parts.fullTime}
        name={parts.name}
        time={parts.time}
        where={parts.where}
      >
        {parts.children}
      </QuoteCardText>
    </a>
  );
}
