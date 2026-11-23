import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function WorkspaceMain(parts: Parts): ReactNode {
  return <main className="relative flex min-h-0 min-w-0 flex-1">{parts.children}</main>;
}
