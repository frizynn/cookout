import type { AuthorParts } from "./parts.ts";
import { Avatar } from "./avatar.tsx";
import type { ReactNode } from "react";
import { Tag } from "./tag.tsx";

const AGENT = "agent";

export function Author(parts: AuthorParts): ReactNode {
  return (
    <span className="flex items-center gap-2">
      <Avatar agent={parts.agent} name={parts.name} />
      <span className="text-sm font-semibold">{parts.shown}</span>
      {parts.agent && <Tag label={AGENT} />}
    </span>
  );
}
