import type { ButtonParts } from "./parts.ts";
import type { ReactNode } from "react";

export function RowButton(parts: ButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <span className="relative z-10 mt-2 flex">
      <button
        className="rounded-md border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:outline-none disabled:opacity-50"
        disabled={parts.disabled}
        onClick={onClick}
        type="button"
      >
        {parts.children}
      </button>
    </span>
  );
}
