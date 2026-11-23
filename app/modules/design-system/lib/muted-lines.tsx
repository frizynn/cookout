import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function MutedLines(parts: Parts): ReactNode {
  return <p className="text-xs whitespace-pre-line text-muted-foreground">{parts.children}</p>;
}
