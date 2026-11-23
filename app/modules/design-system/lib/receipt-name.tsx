import type { LinkParts } from "./parts.ts";
import type { ReactNode } from "react";

export function ReceiptName(parts: LinkParts): ReactNode {
  return (
    <a className="hover:text-foreground hover:underline" href={parts.href}>
      {parts.children}
    </a>
  );
}
