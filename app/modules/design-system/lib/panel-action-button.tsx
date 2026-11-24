import type { ReactNode } from "react";

interface PanelAction {
  readonly label: string;
  readonly name?: string;
  readonly onAction: () => void;
}

interface PanelActionButtonParts {
  readonly action: PanelAction;
}

export function PanelActionButton(parts: PanelActionButtonParts): ReactNode {
  const handleClick = parts.action.onAction;
  return (
    <button
      aria-label={parts.action.name}
      className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={handleClick}
      type="button"
    >
      {parts.action.label}
    </button>
  );
}

export type { PanelAction };
