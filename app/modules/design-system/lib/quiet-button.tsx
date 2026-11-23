import type { ButtonParts } from "./parts.ts";
import type { ReactNode } from "react";

export function QuietButton(parts: ButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <button
        className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        disabled={parts.disabled}
        onClick={onClick}
        type="button"
      >
        {parts.children}
      </button>
    </div>
  );
}
