import type { AgentFaceParts } from "./picker-parts.ts";
import { Avatar } from "./avatar.tsx";
import type { ReactNode } from "react";

const TEXT = { none: "No one" } as const;

export function AgentFace(parts: AgentFaceParts): ReactNode {
  const { agent } = parts;
  if (agent === null) {
    return (
      <>
        <span aria-hidden className="h-6 w-6 shrink-0 rounded-md border border-dashed border-muted-foreground/60" />
        <span className="truncate text-muted-foreground">{TEXT.none}</span>
      </>
    );
  }
  return (
    <>
      <Avatar agent name={agent.name} presence={null} size="row" />
      <span className="truncate font-medium">{agent.displayName ?? agent.name}</span>
      {agent.displayName !== null && agent.displayName !== agent.name && (
        <span className="min-w-0 shrink truncate text-muted-foreground">{`@${agent.name}`}</span>
      )}
    </>
  );
}
