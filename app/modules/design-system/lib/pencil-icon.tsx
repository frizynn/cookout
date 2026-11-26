import { MenuIconFrame } from "./menu-icon-frame.tsx";
import type { ReactNode } from "react";

export function PencilIcon(): ReactNode {
  return (
    <MenuIconFrame>
      <path d="M10.75 2.75 13.25 5.25 5.5 13H3v-2.5z" />
      <path d="M9.25 4.25 11.75 6.75" />
    </MenuIconFrame>
  );
}
