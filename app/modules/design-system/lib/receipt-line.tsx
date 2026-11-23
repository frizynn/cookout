import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function ReceiptLine(parts: Parts): ReactNode {
  return <p className="mt-0.5 text-xs text-muted-foreground">{parts.children}</p>;
}
