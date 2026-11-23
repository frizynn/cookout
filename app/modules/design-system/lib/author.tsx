import type { AuthorParts } from "./parts.ts";
import { Avatar } from "./avatar.tsx";
import type { ReactNode } from "react";
import { Tag } from "./tag.tsx";

const AGENT = "agent";

export function Author(parts: AuthorParts): ReactNode {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar agent={parts.agent} name={parts.name} />
      <span className="truncate text-sm font-semibold">{parts.shown}</span>
      {parts.handle !== null && <span className="truncate text-xs text-muted-foreground">{parts.handle}</span>}
      {parts.agent && <Tag label={AGENT} />}
    </span>
  );
}
