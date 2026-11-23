import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function ButtonRow(parts: Parts): ReactNode {
  return <div className="flex flex-wrap gap-2">{parts.children}</div>;
}
