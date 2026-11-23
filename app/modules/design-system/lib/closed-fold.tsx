import type { ButtonParts } from "./parts.ts";
import type { ReactNode } from "react";

export function ClosedFold(parts: ButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <li className="my-1 flex items-center px-5">
      <span className="h-px flex-1 border-t border-dashed" />
      <button
        className="mx-3 rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onClick}
        type="button"
      >
        {parts.children}
      </button>
      <span className="h-px flex-1 border-t border-dashed" />
    </li>
  );
}
