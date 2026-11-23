import type { LinkParts } from "./parts.ts";
import type { ReactNode } from "react";

export function LinkRow(parts: LinkParts): ReactNode {
  return (
    <li>
      <a className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-accent" href={parts.href}>
        {parts.children}
      </a>
    </li>
  );
}
