import type { ListParts } from "./parts.ts";
import type { ReactNode } from "react";

export function NavList(parts: ListParts): ReactNode {
  return (
    <ul aria-label={parts.label} className="flex flex-col gap-0.5">
      {parts.children}
    </ul>
  );
}
