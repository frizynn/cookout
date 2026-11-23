import type { ListParts } from "./parts.ts";
import type { ReactNode } from "react";

export function ItemList(parts: ListParts): ReactNode {
  return (
    <ul aria-label={parts.label} className="divide-y border-b last:border-b-0">
      {parts.children}
    </ul>
  );
}
