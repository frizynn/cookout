import { Avatar } from "./avatar.tsx";
import type { ReactNode } from "react";

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
}

const VIEW_THREAD = "View thread →";

export function ThreadSummary(parts: ThreadSummaryParts): ReactNode {
  return (
    <a
      aria-label={parts.label}
      className="group/thread mt-1 -ml-1.5 flex w-fit max-w-full items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-xs hover:border-border hover:bg-card focus-visible:border-border focus-visible:bg-card"
      href={parts.href}
    >
      <span className="flex -space-x-1">
        {parts.repliers.map((replier) => (
          <Avatar agent={replier.agent} key={replier.name} name={replier.name} size="tiny" />
        ))}
      </span>
      <span className="font-semibold text-link">{parts.count}</span>
      <span className="text-muted-foreground group-hover/thread:hidden group-focus-visible/thread:hidden">
        {parts.last}
      </span>
      <span className="hidden text-muted-foreground group-hover/thread:inline group-focus-visible/thread:inline">
        {VIEW_THREAD}
      </span>
    </a>
  );
}
