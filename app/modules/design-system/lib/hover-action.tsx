import type { LinkParts } from "./parts.ts";
import type { ReactNode } from "react";

export function HoverAction(parts: LinkParts): ReactNode {
  return (
    <a
      className="block rounded-md border bg-background px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm hover:text-foreground focus-visible:text-foreground"
      href={parts.href}
    >
      {parts.children}
    </a>
  );
}
