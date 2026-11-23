import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function Notice(parts: Parts): ReactNode {
  return (
    <output className="flex items-center justify-between gap-3 border-b bg-muted px-4 py-2 text-xs">
      {parts.children}
    </output>
  );
}
