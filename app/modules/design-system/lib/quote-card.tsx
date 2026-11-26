import { Avatar } from "./avatar.tsx";
import type { QuoteCardParts } from "./quote-card-parts.ts";
import { QuoteCardText } from "./quote-card-text.tsx";
import type { ReactNode } from "react";

export function QuoteCard(parts: QuoteCardParts): ReactNode {
  return (
    <a
      className="mt-1.5 flex w-full max-w-xl gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent motion-safe:active:scale-[0.99]"
      href={parts.href}
    >
      <Avatar agent={parts.agent} name={parts.name} presence={null} size="small" />
      <QuoteCardText author={parts.author} fullTime={parts.fullTime} time={parts.time} where={parts.where}>
        {parts.children}
      </QuoteCardText>
    </a>
  );
}
