import type { ReactNode } from "react";
import type { SidebarParts } from "./parts.ts";

function openStyle(open: boolean): string {
  if (open) {
    return "fixed top-12 bottom-0 left-0 z-30 flex shadow-xl md:static md:shadow-none";
  }
  return "hidden md:flex";
}

export function Sidebar(parts: SidebarParts): ReactNode {
  return (
    <nav aria-label={parts.label} className={`w-64 shrink-0 flex-col border-r bg-card ${openStyle(parts.open)}`}>
      <div className="flex h-14 shrink-0 items-center px-4">
        <span className="font-mono text-sm font-semibold tracking-tight">{parts.title}</span>
      </div>
      {parts.children}
    </nav>
  );
}
