import type { LinkParts } from "./parts.ts";
import type { ReactNode } from "react";

export function QuietLink(parts: LinkParts): ReactNode {
  return (
    <a className="hover:text-foreground hover:underline" href={parts.href}>
      {parts.children}
    </a>
  );
}
