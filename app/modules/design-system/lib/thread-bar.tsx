import type { ReactNode } from "react";

interface ThreadBarParts {
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly children?: ReactNode;
}

export function ThreadBar(parts: ThreadBarParts): ReactNode {
  const { onAction } = parts;
  return (
    <div className="flex shrink-0 items-center gap-3 border-b bg-muted px-5 py-2 text-xs text-muted-foreground">
      <p className="flex-1">{parts.children}</p>
      <button
        className="rounded-md border bg-background px-2.5 py-1 font-medium text-foreground hover:bg-accent"
        onClick={onAction}
        type="button"
      >
        {parts.actionLabel}
      </button>
    </div>
  );
}
