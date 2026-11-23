import type { LinkParts } from "./parts.ts";
import type { ReactNode } from "react";

export function BackLink(parts: LinkParts): ReactNode {
  return (
    <a className="self-start text-xs text-muted-foreground hover:text-foreground" href={parts.href}>
      {parts.children}
    </a>
  );
}
