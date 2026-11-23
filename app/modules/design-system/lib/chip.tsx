import type { ChipParts } from "./parts.ts";
import type { ReactNode } from "react";

function chipStyle(pressed: boolean): string {
  if (pressed) {
    return "border-foreground bg-foreground text-background";
  }
  return "text-muted-foreground hover:text-foreground";
}

export function Chip(parts: ChipParts): ReactNode {
  const { onClick } = parts;
  return (
    <button
      aria-pressed={parts.pressed}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${chipStyle(parts.pressed)}`}
      onClick={onClick}
      type="button"
    >
      {parts.children}
    </button>
  );
}
