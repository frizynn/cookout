import type { ReactNode } from "react";

interface FeedRowTitleParts {
  readonly author: string;
  readonly authorHref: string;
  readonly displayName: string | null;
  readonly note: string | null;
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
      <a className={`relative z-10 hover:underline ${weightOf(parts.bold)}`} href={parts.authorHref}>
        {parts.displayName ?? parts.author}
      </a>
      {parts.displayName !== null && <span className="text-xs text-muted-foreground">{`@${parts.author}`}</span>}
      {parts.note !== null && <span className="text-xs text-muted-foreground">{parts.note}</span>}
      <span className="text-muted-foreground">{parts.action}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">{`#${parts.channel}`}</span>
      <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">{parts.time}</span>
    </span>
  );
}
