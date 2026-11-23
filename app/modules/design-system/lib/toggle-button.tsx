import type { ReactNode } from "react";
import type { ToggleButtonParts } from "./parts.ts";

export function ToggleButton(parts: ToggleButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <button
      aria-expanded={parts.expanded}
      className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={onClick}
      type="button"
    >
      {parts.children}
    </button>
  );
}
