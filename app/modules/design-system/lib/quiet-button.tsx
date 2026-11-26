import type { ButtonParts } from "./parts.ts";
import type { ReactNode } from "react";

interface QuietButtonParts extends ButtonParts {
  readonly controls?: string;
}

export function QuietButton(parts: QuietButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <div className="flex flex-col items-center gap-2 pt-4 max-md:items-stretch max-md:pt-0">
      <button
        aria-controls={parts.controls}
        className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 max-md:min-h-11 max-md:rounded-[10px] max-md:border-transparent max-md:bg-muted max-md:px-4 max-md:text-[15px] max-md:text-foreground"
        disabled={parts.disabled}
        onClick={onClick}
        type="button"
      >
        {parts.children}
      </button>
    </div>
  );
}
