import type { ReactNode } from "react";

interface ThreadNewsParts {
  readonly children: string;
  readonly forYou: boolean;
}

function lookOf(forYou: boolean): string {
  if (forYou) {
    return "rounded-full bg-mention-bar px-1.5 py-px font-semibold text-mention-ink";
  }
  return "font-semibold text-foreground";
}

export function ThreadNews(parts: ThreadNewsParts): ReactNode {
  return <span className={lookOf(parts.forYou)}>{parts.children}</span>;
}
