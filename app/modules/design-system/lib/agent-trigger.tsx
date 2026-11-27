import type { AgentChoice } from "./picker-parts.ts";
import { AgentFace } from "./agent-face.tsx";
import { CONTROL } from "./field-ids.ts";
import { ChevronIcon } from "./chevron-icon.tsx";
import type { FieldIds } from "./prompt-parts.ts";
import type { ReactNode } from "react";
import { Trigger } from "@radix-ui/react-popover";

interface AgentTriggerParts {
  readonly ids: FieldIds;
  readonly agent: AgentChoice | null;
  readonly spoken: string;
}

export function AgentTrigger(parts: AgentTriggerParts): ReactNode {
  return (
    <Trigger asChild>
      <button
        aria-describedby={parts.ids.describedBy}
        aria-label={parts.spoken}
        className={`${CONTROL} flex h-10 cursor-pointer items-center gap-2.5 pl-2 text-left data-[state=open]:border-muted-foreground max-md:h-12`}
        id={parts.ids.control}
        type="button"
      >
        <AgentFace agent={parts.agent} />
        <ChevronIcon />
      </button>
    </Trigger>
  );
}
