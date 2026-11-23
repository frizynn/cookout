import type { IdentityRowParts } from "./parts.ts";
import type { ReactNode } from "react";

interface IdentityNameLineParts {
  readonly row: IdentityRowParts;
}

export function IdentityNameLine(parts: IdentityNameLineParts): ReactNode {
  const { row } = parts;
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="truncate font-semibold">{row.name}</span>
      {row.note !== null && <span className="text-xs text-muted-foreground">{row.note}</span>}
      {row.children}
    </span>
  );
}
