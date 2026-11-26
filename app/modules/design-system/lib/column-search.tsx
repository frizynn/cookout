import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";
import { useNarrowScreen } from "./use-narrow-screen.ts";

interface ColumnSearchParts extends Parts {
  readonly sidebarCollapsed: boolean;
  readonly sidebarOpen: boolean;
}

export function ColumnSearch(parts: ColumnSearchParts): ReactNode {
  const narrow = useNarrowScreen();
  const rail = parts.sidebarCollapsed && !parts.sidebarOpen;
  if (!narrow && !rail) {
    return null;
  }
  return parts.children;
}
