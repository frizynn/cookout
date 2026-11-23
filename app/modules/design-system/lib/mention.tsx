import type { ReactNode } from "react";

interface MentionParts {
  readonly children: ReactNode;
  readonly mine: boolean;
}

function lookOf(mine: boolean): string {
  if (mine) {
    return "rounded bg-mention-bg px-1 font-medium text-mention-fg ring-1 ring-mention-bar/40";
  }
  return "rounded px-0.5 font-medium text-link";
}

export function Mention(parts: MentionParts): ReactNode {
  return <span className={lookOf(parts.mine)}>{parts.children}</span>;
}
