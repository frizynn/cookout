import { CollapseButton } from "./collapse-button.tsx";
import type { ReactNode } from "react";
import type { SidebarParts } from "./parts.ts";

function openStyle(open: boolean): string {
  if (open) {
    return "fixed top-12 bottom-0 left-0 z-30 flex shadow-xl md:static md:shadow-none";
  }
  return "hidden md:flex";
}

function widthStyle(rail: boolean): string {
  if (rail) {
    return "w-12";
  }
  return "w-64";
}

function headerStyle(rail: boolean): string {
  if (rail) {
    return "justify-center";
  }
  return "justify-between px-4";
}

export function Sidebar(parts: SidebarParts): ReactNode {
  const handleToggle = parts.onToggleCollapsed;
  const rail = parts.collapsed && !parts.open;
  return (
    <nav
      aria-label={parts.label}
      className={`${widthStyle(rail)} shrink-0 flex-col border-r bg-card ${openStyle(parts.open)}`}
    >
      <div className={`flex h-14 shrink-0 items-center ${headerStyle(rail)}`}>
        {!rail && <span className="font-mono text-sm font-semibold tracking-tight">{parts.title}</span>}
        <CollapseButton collapsed={rail} onClick={handleToggle} />
      </div>
      {!rail && parts.children}
    </nav>
  );
}
