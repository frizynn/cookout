import type { ReactNode } from "react";
import type { TextFieldParts } from "./parts.ts";

const ROWS = 3;

export function DataArea(parts: TextFieldParts): ReactNode {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {parts.label}
      <textarea
        autoComplete="off"
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-muted-foreground"
        name={parts.name}
        required
        rows={ROWS}
        spellCheck={false}
      />
    </label>
  );
}
