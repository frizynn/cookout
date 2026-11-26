import { MenuIconFrame } from "./menu-icon-frame.tsx";
import type { ReactNode } from "react";

export function CalendarIcon(): ReactNode {
  return (
    <MenuIconFrame>
      <rect height="10.5" rx="1.5" width="11" x="2.5" y="3.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </MenuIconFrame>
  );
}
