import type { ReactNode } from "react";

interface ConversationEmptyParts {
  readonly label: string;
  readonly children: ReactNode;
}

export function ConversationEmpty(parts: ConversationEmptyParts): ReactNode {
  return (
    <aside
      aria-label={parts.label}
      className="hidden w-full items-center justify-center bg-card text-sm text-muted-foreground md:flex md:w-md md:shrink-0 md:border-l lg:w-xl"
    >
      {parts.children}
    </aside>
  );
}
