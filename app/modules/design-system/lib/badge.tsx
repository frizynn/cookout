import type { ReactNode } from "react";

interface BadgeParts {
  readonly children: ReactNode;
  readonly tone: "mention" | "plain";
}

const TONES = {
  mention: "border-mention-bar/40 bg-mention-bg text-mention-fg",
  plain: "text-muted-foreground",
} as const;

export function Badge(parts: BadgeParts): ReactNode {
  return (
    <span className={`rounded border px-1.5 py-px text-[10px] font-medium ${TONES[parts.tone]}`}>{parts.children}</span>
  );
}
