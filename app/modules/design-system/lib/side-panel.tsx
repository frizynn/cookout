import { CloseLink } from "./close-link.tsx";
import type { ReactNode } from "react";
import type { SidePanelParts } from "./parts.ts";

export function SidePanel(parts: SidePanelParts): ReactNode {
  return (
    <aside
      aria-label={parts.label}
      className="absolute inset-0 z-20 flex w-full flex-col bg-card md:static md:w-md md:shrink-0 md:border-l"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
        <h2 className="text-sm font-semibold">{parts.label}</h2>
        <span className="flex-1 font-mono text-xs text-muted-foreground">{parts.detail}</span>
        <CloseLink href={parts.closeHref} label={parts.closeLabel} />
      </header>
      {parts.children}
    </aside>
  );
}
