import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";
import { useNarrowScreen } from "./use-narrow-screen.ts";

interface WorkspaceColumnParts extends Parts {
  readonly sidebarOpen: boolean;
}

export function WorkspaceColumn(parts: WorkspaceColumnParts): ReactNode {
  const narrow = useNarrowScreen();
  const covered = parts.sidebarOpen && narrow;
  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col md:my-2 md:mr-2 md:overflow-hidden md:rounded-xl md:border md:bg-background md:shadow-xs"
      inert={covered}
    >
      {parts.children}
    </div>
  );
}
