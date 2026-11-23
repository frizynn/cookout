import type { ListParts } from "./parts.ts";
import type { ReactNode } from "react";

export function LinkList(parts: ListParts): ReactNode {
  return (
    <ul aria-label={parts.label} className="divide-y">
      {parts.children}
    </ul>
  );
}
