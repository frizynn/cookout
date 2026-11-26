import type { PressButtonParts } from "./parts.ts";
import type { ReactNode } from "react";

function pressStyle(pressed: boolean): string {
  if (pressed) {
    return "bg-accent text-muted-foreground hover:text-foreground";
  }
  return "text-foreground hover:bg-accent";
}

export function PressButton(parts: PressButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <button
      aria-pressed={parts.pressed}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 max-md:min-h-11 max-md:rounded-[10px] max-md:px-4 max-md:text-[15px] ${pressStyle(parts.pressed)}`}
      disabled={parts.disabled}
      onClick={onClick}
      type="button"
    >
      {parts.children}
    </button>
  );
}
