import type { AgentListParts } from "./picker-parts.ts";
import { AgentOption } from "./agent-option.tsx";
import type { ReactNode } from "react";
import { useListKeys } from "./use-list-keys.ts";

export function AgentList(parts: AgentListParts): ReactNode {
  const handleKey = useListKeys();
  const handlePick = parts.onPick;
  return (
    <div className="flex max-h-72 w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] flex-col gap-0.5 overflow-y-auto overscroll-contain">
      <AgentOption agent={null} onKey={handleKey} onPick={handlePick} selected={parts.selected === ""} />
      {parts.agents.map((agent) => (
        <AgentOption
          agent={agent}
          key={agent.name}
          onKey={handleKey}
          onPick={handlePick}
          selected={agent.name === parts.selected}
        />
      ))}
    </div>
  );
}
