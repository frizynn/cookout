import { FeedRowClosed } from "./feed-row-closed.tsx";
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
  readonly count: string | null;
  readonly closed: boolean;
}

function weightOf(bold: boolean): string {
  if (bold) {
    return "font-semibold";
  }
  return "font-medium";
}

export function FeedRowTitle(parts: FeedRowTitleParts): ReactNode {
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
      <a className={`relative z-10 hover:underline ${weightOf(parts.bold)}`} href={parts.authorHref}>
        {parts.displayName ?? parts.author}
      </a>
      {parts.displayName !== null && <span className="text-xs text-muted-foreground">{`@${parts.author}`}</span>}
      {parts.note !== null && <span className="text-xs text-muted-foreground">{parts.note}</span>}
      <span className="text-muted-foreground">{parts.action}</span>
      <span className="truncate text-xs text-muted-foreground">{`#${parts.channel}`}</span>
      <FeedRowClosed closed={parts.closed} />
      <span className="ml-auto flex shrink-0 items-baseline gap-1.5">
        {parts.count !== null && (
          <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-foreground tabular-nums">
            {parts.count}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground tabular-nums">{parts.time}</span>
      </span>
    </span>
  );
}
