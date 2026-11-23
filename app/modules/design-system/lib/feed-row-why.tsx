import type { ReactNode } from "react";

interface FeedRowWhyParts {
  readonly level: "for-you" | "activity" | "read";
  readonly children: string;
}

const LOOKS = {
  activity: "text-muted-foreground",
  "for-you": "font-semibold text-mention-fg",
  read: "text-muted-foreground",
} as const;

export function FeedRowWhy(parts: FeedRowWhyParts): ReactNode {
  return <span className={`mb-0.5 text-[11px] ${LOOKS[parts.level]}`}>{parts.children}</span>;
}
