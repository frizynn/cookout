import type { ReactNode } from "react";

interface PanelTitleTextParts {
  readonly label: string;
  readonly detail: string;
}

export function PanelTitleText(parts: PanelTitleTextParts): ReactNode {
  return (
    <div className="flex flex-1 items-center gap-2">
      <h2 className="text-sm font-semibold">{parts.label}</h2>
      <span className="flex-1 font-mono text-xs text-muted-foreground">{parts.detail}</span>
    </div>
  );
}
