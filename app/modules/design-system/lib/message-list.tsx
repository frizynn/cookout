import type { ListParts } from "./parts.ts";
import type { ReactNode } from "react";

export function MessageList(parts: ListParts): ReactNode {
  return (
    <ul aria-label={parts.label} className="flex flex-col">
      {parts.children}
    </ul>
  );
}
