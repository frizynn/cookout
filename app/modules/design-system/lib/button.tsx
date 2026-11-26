import type { ButtonParts } from "./parts.ts";
import type { ReactNode } from "react";
import { useFocusOnOpen } from "./focus-on-open.ts";

export function Button(parts: ButtonParts): ReactNode {
  const { onClick } = parts;
  const button = useFocusOnOpen<HTMLButtonElement>(parts.focused === true);
  return (
    <button
      className="self-start rounded-md border bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50 max-md:min-h-11 max-md:rounded-[10px] max-md:border-transparent max-md:bg-muted max-md:px-4 max-md:text-[15px] max-md:text-foreground"
      disabled={parts.disabled}
      onClick={onClick}
      ref={button}
      type="button"
    >
      {parts.children}
    </button>
  );
}
