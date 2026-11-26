import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function ButtonRow(parts: Parts): ReactNode {
  return <div className="flex flex-wrap items-center gap-2 max-md:*:flex-1">{parts.children}</div>;
}
