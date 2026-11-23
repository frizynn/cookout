import type { ButtonParts } from "./parts.ts";
import type { ReactNode } from "react";

export function Button(parts: ButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <button
      className="self-start rounded-md border bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      disabled={parts.disabled}
      onClick={onClick}
      type="button"
    >
      {parts.children}
    </button>
  );
}
