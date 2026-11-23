import type { DataBlockParts } from "./parts.ts";
import type { ReactNode } from "react";

const INDENT = 2;
const TEXT = { closed: "▸ data", open: "▾ data" } as const;

export function DataToggle(parts: DataBlockParts): ReactNode {
  return (
    <details className="group/data">
      <summary className="w-fit cursor-pointer list-none font-mono text-[11px] text-muted-foreground hover:text-foreground">
        <span className="group-open/data:hidden">{TEXT.closed}</span>
        <span className="hidden group-open/data:inline">{TEXT.open}</span>
      </summary>
      <pre
        aria-label={parts.label}
        className="mt-1 overflow-x-auto rounded-md border bg-card px-3 py-2 font-mono text-xs"
      >
        {JSON.stringify(parts.value, null, INDENT)}
      </pre>
    </details>
  );
}
