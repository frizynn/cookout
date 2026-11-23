import type { LinkParts } from "./parts.ts";
import type { ReactNode } from "react";

export function ReplyCount(parts: LinkParts): ReactNode {
  return (
    <a
      className="-ml-1.5 w-fit rounded-md border border-transparent px-1.5 py-1 text-xs font-semibold text-link hover:border-border hover:bg-card"
      href={parts.href}
    >
      {parts.children}
    </a>
  );
}
