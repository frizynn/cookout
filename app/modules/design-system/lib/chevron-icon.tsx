import { MenuIconFrame } from "./menu-icon-frame.tsx";
import type { ReactNode } from "react";

export function ChevronIcon(): ReactNode {
  return (
    <span className="ml-auto flex text-muted-foreground">
      <MenuIconFrame>
        <path d="M4.5 6.5 8 10l3.5-3.5" />
      </MenuIconFrame>
    </span>
  );
}
