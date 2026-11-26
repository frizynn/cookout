import { MenuIconFrame } from "./menu-icon-frame.tsx";
import type { ReactNode } from "react";

export function GearIcon(): ReactNode {
  return (
    <MenuIconFrame>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </MenuIconFrame>
  );
}
