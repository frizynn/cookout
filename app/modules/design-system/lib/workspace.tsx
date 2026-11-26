import { MenuButton } from "./menu-button.tsx";
import type { ReactNode } from "react";
import type { WorkspaceParts } from "./parts.ts";
import { useVisibleArea } from "./use-visible-area.ts";

const TEXT = { topBar: "Top bar" } as const;

export function Workspace(parts: WorkspaceParts): ReactNode {
  const handleToggle = parts.onToggleSidebar;
  useVisibleArea();
  return (
    <div className="visible-frame flex flex-col bg-background font-sans text-foreground max-md:[&:has(main_aside:not(.hidden))>header]:hidden md:flex-row md:bg-card">
      <header
        aria-label={TEXT.topBar}
        className="absolute top-[env(safe-area-inset-top)] left-[env(safe-area-inset-left)] z-50 flex h-14 items-center px-2.5 md:hidden"
      >
        <MenuButton onClick={handleToggle} open={parts.sidebarOpen} />
      </header>
      {parts.children}
    </div>
  );
}
