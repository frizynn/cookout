import type { ReactNode } from "react";

interface ConversationEmptyParts {
  readonly label: string;
  readonly children: ReactNode;
  readonly hiddenWhenNarrow: boolean;
}

function lookOf(hiddenWhenNarrow: boolean): string {
  if (hiddenWhenNarrow) {
    return "hidden md:flex";
  }
  return "flex";
}

export function ConversationEmpty(parts: ConversationEmptyParts): ReactNode {
  return (
    <aside
      aria-label={parts.label}
      className={`w-full items-center justify-center bg-card text-sm text-muted-foreground md:w-md md:shrink-0 md:border-l lg:w-xl ${lookOf(parts.hiddenWhenNarrow)}`}
    >
      {parts.children}
    </aside>
  );
}
