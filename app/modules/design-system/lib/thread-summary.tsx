import { Avatar } from "./avatar.tsx";
import type { ReactNode } from "react";
import { ThreadNews } from "./thread-news.tsx";

interface Replier {
  readonly name: string;
  readonly agent: boolean;
}

interface ThreadSummaryParts {
  readonly href: string;
  readonly repliers: readonly Replier[];
  readonly label: string;
  readonly count: string;
  readonly last: string;
  readonly news: { readonly text: string; readonly forYou: boolean } | null;
}

const OPENS = " →";

export function ThreadSummary(parts: ThreadSummaryParts): ReactNode {
  return (
    <a
      aria-label={parts.label}
      className="group/thread mt-1 -ml-1.5 flex w-fit max-w-full items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-xs hover:border-border hover:bg-card focus-visible:border-border focus-visible:bg-card max-md:ml-0 max-md:flex-wrap max-md:gap-x-2 max-md:gap-y-1 max-md:rounded-lg max-md:border-border max-md:bg-card max-md:px-2.5 max-md:py-2 max-md:text-[13px] max-md:*:whitespace-nowrap max-md:active:bg-accent"
      href={parts.href}
    >
      <span className="isolate flex -space-x-1 *:nth-1:z-30 *:nth-2:z-20 *:nth-3:z-10">
        {parts.repliers.map((replier) => (
          <Avatar agent={replier.agent} key={replier.name} name={replier.name} presence={null} size="tiny" />
        ))}
      </span>
      <span className="font-medium text-link">{parts.count}</span>
      {parts.news !== null && <ThreadNews forYou={parts.news.forYou}>{parts.news.text}</ThreadNews>}
      <span className="text-muted-foreground">
        {parts.last}
        <span className="hidden group-hover/thread:inline group-focus-visible/thread:inline">{OPENS}</span>
      </span>
    </a>
  );
}
