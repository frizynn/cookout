import { useCallback, useState } from "react";
import type { AgentFieldParts } from "./picker-parts.ts";
import { AgentPopover } from "./agent-popover.tsx";
import { FieldLabel } from "./field-label.tsx";
import { FieldNotes } from "./field-notes.tsx";
import type { ReactNode } from "react";
import { useFieldIds } from "./field-ids.ts";

export function AgentField(parts: AgentFieldParts): ReactNode {
  const { onEdit } = parts;
  const ids = useFieldIds(parts);
  const [open, setOpen] = useState(false);
  const handlePick = useCallback(
    (name: string) => {
      onEdit(name);
      setOpen(false);
    },
    [onEdit],
  );
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel ids={ids} label={parts.label} required={parts.required} />
      <AgentPopover
        agents={parts.agents}
        ids={ids}
        label={parts.label}
        onOpenChange={setOpen}
        onPick={handlePick}
        open={open}
        value={parts.value}
      />
      <FieldNotes error={parts.error} help={parts.help} ids={ids} />
    </div>
  );
}
