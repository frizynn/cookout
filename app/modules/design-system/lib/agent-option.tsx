import type { AgentChoice, AgentOptionParts } from "./picker-parts.ts";
import { AgentFace } from "./agent-face.tsx";
import { CheckIcon } from "./check-icon.tsx";
import type { ReactNode } from "react";
import { useCallback } from "react";

const BASE =
  "flex shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground outline-none hover:bg-accent focus:bg-accent focus-visible:ring-2 focus-visible:ring-muted-foreground max-md:py-2.5 max-md:text-[15px]";
const IN_TAB_ORDER = 0;
const OUT_OF_TAB_ORDER = -1;

function nameOf(agent: AgentChoice | null): string {
  if (agent === null) {
    return "";
  }
  return agent.name;
}

function tabOf(selected: boolean): number {
  if (selected) {
    return IN_TAB_ORDER;
  }
  return OUT_OF_TAB_ORDER;
}

export function AgentOption(parts: AgentOptionParts): ReactNode {
  const { agent, onPick } = parts;
  const handleKey = parts.onKey;
  const handlePick = useCallback(() => {
    onPick(nameOf(agent));
  }, [agent, onPick]);
  return (
    <button
      aria-pressed={parts.selected}
      className={BASE}
      onClick={handlePick}
      onKeyDown={handleKey}
      tabIndex={tabOf(parts.selected)}
      type="button"
    >
      <AgentFace agent={agent} />
      <span className="ml-auto flex pl-2 text-foreground">{parts.selected && <CheckIcon />}</span>
    </button>
  );
}
