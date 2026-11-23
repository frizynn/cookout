import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function NavHeading(parts: Parts): ReactNode {
  return (
    <h2 className="px-4 pt-5 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {parts.children}
    </h2>
  );
}
