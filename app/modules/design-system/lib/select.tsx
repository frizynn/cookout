import type { ReactNode } from "react";
import type { SelectParts } from "./parts.ts";

export function Select(parts: SelectParts): ReactNode {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {parts.label}
      <select
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-muted-foreground"
        name={parts.name}
        required
      >
        {parts.children}
      </select>
    </label>
  );
}
