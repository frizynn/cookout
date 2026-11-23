import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function WorkspaceColumn(parts: Parts): ReactNode {
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">{parts.children}</div>;
}
