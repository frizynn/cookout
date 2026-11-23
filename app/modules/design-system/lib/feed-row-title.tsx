import type { ReactNode } from "react";

interface FeedRowTitleParts {
  readonly author: string;
  readonly bold: boolean;
  readonly action: string;
  readonly channel: string;
  readonly time: string;
}

function weightOf(bold: boolean): string {
  if (bold) {
    return "font-semibold";
  }
  return "font-medium";
}

export function FeedRowTitle(parts: FeedRowTitleParts): ReactNode {
  return (
    <span className="flex items-baseline gap-1.5 text-[13px]">
      <span className={weightOf(parts.bold)}>{parts.author}</span>
      <span className="text-muted-foreground">{parts.action}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">{`#${parts.channel}`}</span>
      <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">{parts.time}</span>
    </span>
  );
}
