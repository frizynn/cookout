import { FeedRowTitle } from "./feed-row-title.tsx";
import { FeedRowWhy } from "./feed-row-why.tsx";
import type { ReactNode } from "react";

interface FeedRowParts {
  readonly level: "for-you" | "activity" | "read";
  readonly why: string;
  readonly author: string;
  readonly displayName: string | null;
  readonly action: string;
  readonly channel: string;
  readonly time: string;
  readonly context: string | null;
  readonly children: ReactNode;
}

const DOTS = { activity: "bg-muted-foreground/60", "for-you": "bg-mention-bar", read: "hidden" } as const;

export function FeedRowBody(parts: FeedRowParts): ReactNode {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span
        aria-hidden="true"
        className={`absolute top-[1.35rem] left-0 h-1.5 w-1.5 rounded-full ${DOTS[parts.level]}`}
      />
      <FeedRowWhy level={parts.level}>{parts.why}</FeedRowWhy>
      <FeedRowTitle
        action={parts.action}
        author={parts.author}
        bold={parts.level !== "read"}
        channel={parts.channel}
        displayName={parts.displayName}
        time={parts.time}
      />
      {parts.context !== null && (
        <span className="mt-0.5 truncate text-xs text-muted-foreground">{`re: ${parts.context}`}</span>
      )}
      {parts.children}
    </span>
  );
}

export type { FeedRowParts };
