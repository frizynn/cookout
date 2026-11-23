import type { ButtonParts } from "./parts.ts";
import type { ReactNode } from "react";

export function HoverButton(parts: ButtonParts): ReactNode {
  const handleClick = parts.onClick;
  return (
    <button
      className="block rounded-md border bg-background px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm hover:text-foreground focus-visible:text-foreground"
      onClick={handleClick}
      type="button"
    >
      {parts.children}
    </button>
  );
}
