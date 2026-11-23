import type { DataBlockParts } from "./parts.ts";
import type { ReactNode } from "react";

const INDENT = 2;

export function DataBlock(parts: DataBlockParts): ReactNode {
  return (
    <pre
      aria-label={parts.label}
      className="overflow-x-auto rounded-md border bg-muted px-3 py-2 text-xs text-foreground"
    >
      {JSON.stringify(parts.value, null, INDENT)}
    </pre>
  );
}
