import type { ButtonParts } from "./parts.ts";
import type { ReactNode } from "react";

export function SubmitButton(parts: Omit<ButtonParts, "onClick">): ReactNode {
  return (
    <button
      className="self-start rounded-md max-md:self-stretch border bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50 max-md:min-h-11 max-md:rounded-[10px] max-md:px-4 max-md:text-[15px]"
      disabled={parts.disabled}
      type="submit"
    >
      {parts.children}
    </button>
  );
}
