import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";
import { useNarrowScreen } from "./use-narrow-screen.ts";

export function SidebarSearch(parts: Parts): ReactNode {
  const narrow = useNarrowScreen();
  if (narrow) {
    return null;
  }
  return parts.children;
}
