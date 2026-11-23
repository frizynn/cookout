import { MenuButton } from "./menu-button.tsx";
import type { ReactNode } from "react";
import type { WorkspaceParts } from "./parts.ts";

export function Workspace(parts: WorkspaceParts): ReactNode {
  const handleToggle = parts.onToggleSidebar;
  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground md:flex-row">
      <div className="flex h-12 shrink-0 items-center border-b px-3 md:hidden">
        <MenuButton onClick={handleToggle} open={parts.sidebarOpen} />
      </div>
      {parts.children}
    </div>
  );
}
