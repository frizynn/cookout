import type { ReactNode } from "react";

interface ThreadBarParts {
  readonly children: ReactNode;
}

export function ThreadBar(parts: ThreadBarParts): ReactNode {
  return (
    <p className="shrink-0 border-b bg-muted px-5 py-2 text-xs text-muted-foreground motion-safe:animate-fade-in max-md:px-4">
      {parts.children}
    </p>
  );
}
