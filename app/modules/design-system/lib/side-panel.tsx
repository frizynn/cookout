import { CloseLink } from "./close-link.tsx";
import { PanelEdge } from "./panel-edge.tsx";
import type { PanelEdgeParts } from "./panel-edge-parts.ts";
import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";
import { panelWidth } from "./panel-width.ts";

interface SidePanelParts extends Parts {
  readonly label: string;
  readonly detail: string;
  readonly closeHref: string;
  readonly closeLabel: string;
  readonly edge: PanelEdgeParts | null;
}

export function SidePanel(parts: SidePanelParts): ReactNode {
  const { edge } = parts;
  const look = panelWidth({ edge, fixed: "md:w-md" });
  return (
    <aside
      aria-label={parts.label}
      className={`absolute inset-0 z-20 flex w-full flex-col bg-card md:relative md:shrink-0 md:border-l ${look.width}`}
      style={look.style}
    >
      {edge !== null && <PanelEdge edge={edge} />}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
        <h2 className="text-sm font-semibold">{parts.label}</h2>
        <span className="flex-1 font-mono text-xs text-muted-foreground">{parts.detail}</span>
        <CloseLink href={parts.closeHref} label={parts.closeLabel} />
      </header>
      {parts.children}
    </aside>
  );
}
