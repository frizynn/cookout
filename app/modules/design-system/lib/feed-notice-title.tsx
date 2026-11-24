import type { ReactNode } from "react";

interface FeedNoticeTitleParts {
  readonly name: string;
  readonly href: string;
  readonly displayName: string | null;
  readonly note: string | null;
  readonly bold: boolean;
  readonly time: string;
}

function weightOf(bold: boolean): string {
  if (bold) {
    return "font-semibold";
  }
  return "font-medium";
}

export function FeedNoticeTitle(parts: FeedNoticeTitleParts): ReactNode {
  return (
    <span className="flex items-baseline gap-1.5 text-[13px]">
      <a className={`hover:underline ${weightOf(parts.bold)}`} href={parts.href}>
        {parts.displayName ?? parts.name}
      </a>
      {parts.displayName !== null && <span className="text-xs text-muted-foreground">{`@${parts.name}`}</span>}
      {parts.note !== null && <span className="text-xs text-muted-foreground">{parts.note}</span>}
      <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">{parts.time}</span>
    </span>
  );
}
