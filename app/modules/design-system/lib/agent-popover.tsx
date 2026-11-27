import type { AgentChoice } from "./picker-parts.ts";
import { AgentList } from "./agent-list.tsx";
import { AgentTrigger } from "./agent-trigger.tsx";
import type { FieldIds } from "./prompt-parts.ts";
import { PickerContent } from "./picker-content.tsx";
import type { ReactNode } from "react";
import { Root } from "@radix-ui/react-popover";

interface AgentPopoverParts {
  readonly ids: FieldIds;
  readonly label: string;
  readonly agents: readonly AgentChoice[];
  readonly value: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPick: (name: string) => void;
}

const TEXT = { none: "No one" } as const;

function pickedOf(agents: readonly AgentChoice[], value: string): AgentChoice | null {
  return agents.find((agent) => agent.name === value) ?? null;
}

function spokenOf(label: string, agent: AgentChoice | null): string {
  if (agent === null) {
    return `${label}: ${TEXT.none}`;
  }
  return `${label}: ${agent.name}`;
}

export function AgentPopover(parts: AgentPopoverParts): ReactNode {
  const handleOpenChange = parts.onOpenChange;
  const handlePick = parts.onPick;
  const agent = pickedOf(parts.agents, parts.value);
  return (
    <Root onOpenChange={handleOpenChange} open={parts.open}>
      <AgentTrigger agent={agent} ids={parts.ids} spoken={spokenOf(parts.label, agent)} />
      <PickerContent label={parts.label}>
        <AgentList agents={parts.agents} onPick={handlePick} selected={parts.value} />
      </PickerContent>
    </Root>
  );
}
