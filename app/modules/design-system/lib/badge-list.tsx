import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function BadgeList(parts: Parts): ReactNode {
  return <span className="mt-1.5 flex gap-1">{parts.children}</span>;
}
