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
      className="fixed inset-x-0 top-0 flex h-dvh flex-col bg-background font-sans text-foreground md:flex-row"
      style={visible}
    >
      <header aria-label={TEXT.topBar} className="flex h-12 shrink-0 items-center border-b px-3 md:hidden">
        <MenuButton onClick={handleToggle} open={parts.sidebarOpen} />
      </header>
      {parts.children}
    </div>
  );
}
