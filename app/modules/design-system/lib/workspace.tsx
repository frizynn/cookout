import { MenuButton } from "./menu-button.tsx";
import type { ReactNode } from "react";
import type { WorkspaceParts } from "./parts.ts";

const TEXT = { topBar: "Top bar" } as const;

export function Workspace(parts: WorkspaceParts): ReactNode {
  const handleToggle = parts.onToggleSidebar;
  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground md:flex-row">
      <header aria-label={TEXT.topBar} className="flex h-12 shrink-0 items-center border-b px-3 md:hidden">
        <MenuButton onClick={handleToggle} open={parts.sidebarOpen} />
      </header>
      {parts.children}
    </div>
  );
}
