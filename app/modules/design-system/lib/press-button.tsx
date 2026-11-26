import type { PressButtonParts } from "./parts.ts";
import type { ReactNode } from "react";
import { TOGGLE_BUTTON } from "./button-look.ts";
import { menuIcon } from "./menu-icons.ts";

function pressStyle(pressed: boolean): string {
  if (pressed) {
    return "border-transparent bg-accent text-muted-foreground hover:text-foreground";
  }
  return "bg-surface text-foreground shadow-xs hover:bg-accent max-md:bg-transparent max-md:shadow-none";
}

export function PressButton(parts: PressButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <button
      aria-pressed={parts.pressed}
      className={`${TOGGLE_BUTTON} ${pressStyle(parts.pressed)}`}
      disabled={parts.disabled}
      onClick={onClick}
      type="button"
    >
      {typeof parts.icon === "string" && menuIcon(parts.icon)}
      {parts.children}
    </button>
  );
}
