import type { ReactNode } from "react";

interface FeedParts {
  readonly label: string;
  readonly children: ReactNode;
}

export function Feed(parts: FeedParts): ReactNode {
  return (
    <section aria-label={parts.label} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-4">{parts.children}</div>
    </section>
  );
}
