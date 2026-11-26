import { MenuButton } from "./menu-button.tsx";
import type { ReactNode } from "react";
import type { WorkspaceParts } from "./parts.ts";
import { useVisibleArea } from "./use-visible-area.ts";

const TEXT = { topBar: "Top bar" } as const;

export function Workspace(parts: WorkspaceParts): ReactNode {
  const handleToggle = parts.onToggleSidebar;
  const visible = useVisibleArea();
  return (
    <div
      className="fixed inset-x-0 top-0 flex h-dvh flex-col bg-background font-sans text-foreground max-md:[&:has(main_aside:not(.hidden))>header]:hidden md:flex-row"
      style={visible}
    >
      <header aria-label={TEXT.topBar} className="absolute top-0 left-0 z-50 flex h-14 items-center px-2.5 md:hidden">
        <MenuButton onClick={handleToggle} open={parts.sidebarOpen} />
      </header>
      {parts.children}
    </div>
  );
}
