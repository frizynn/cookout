import type { AuthorParts } from "./parts.ts";
import { Avatar } from "./avatar.tsx";
import type { ReactNode } from "react";

const AGENT = "agent";

export function Author(parts: AuthorParts): ReactNode {
  return (
    <span className="flex items-center gap-2">
      <Avatar agent={parts.agent} name={parts.name} />
      <span className="text-sm font-semibold">{parts.shown}</span>
      {parts.agent && (
        <span className="rounded border px-1 py-px text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase">
          {AGENT}
        </span>
      )}
    </span>
  );
}
