import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function SidebarFooter(parts: Parts): ReactNode {
  return <div className="relative flex flex-col gap-3 border-t px-4 py-3">{parts.children}</div>;
}
