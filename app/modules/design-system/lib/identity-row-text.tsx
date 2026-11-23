import { IdentityNameLine } from "./identity-name-line.tsx";
import type { IdentityRowParts } from "./parts.ts";
import type { ReactNode } from "react";

interface IdentityRowTextParts {
  readonly row: IdentityRowParts;
}

export function IdentityRowText(parts: IdentityRowTextParts): ReactNode {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <IdentityNameLine row={parts.row} />
      <span className="text-xs text-muted-foreground">{parts.row.detail}</span>
    </span>
  );
}
