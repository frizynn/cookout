import type { ReactNode } from "react";

interface FeedHeadingParts {
  readonly title: string;
  readonly count: number | null;
}

const TITLE = "text-[11px] font-semibold tracking-wider text-muted-foreground uppercase";

export function FeedHeading(parts: FeedHeadingParts): ReactNode {
  if (parts.count === null) {
    return (
      <div className="my-4 flex items-center gap-3 px-3">
        <h2 className={TITLE}>{parts.title}</h2>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return (
    <h2 className={`px-3 pb-1 ${TITLE}`}>
      {parts.title} <span className="ml-1 text-foreground tabular-nums">{String(parts.count)}</span>
    </h2>
  );
}
