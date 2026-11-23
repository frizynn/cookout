import { FeedRowTitle } from "./feed-row-title.tsx";
import type { ReactNode } from "react";

interface FeedRowParts {
  readonly unread: boolean;
  readonly author: string;
  readonly displayName: string | null;
  readonly action: string;
  readonly channel: string;
  readonly time: string;
  readonly context: string | null;
  readonly children: ReactNode;
}

export function FeedRowBody(parts: FeedRowParts): ReactNode {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      {parts.unread && (
        <span aria-hidden="true" className="absolute top-[1.35rem] left-0 h-1.5 w-1.5 rounded-full bg-link" />
      )}
      <FeedRowTitle
        action={parts.action}
        author={parts.author}
        bold={parts.unread}
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
