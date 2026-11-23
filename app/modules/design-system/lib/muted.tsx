import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function Muted(parts: Parts): ReactNode {
  return <p className="text-xs text-muted-foreground">{parts.children}</p>;
}
