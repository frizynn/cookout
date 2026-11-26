import { useCallback, useState } from "react";
import { FieldLabel } from "./field-label.tsx";
import { FieldNotes } from "./field-notes.tsx";
import type { InputFieldParts } from "./prompt-parts.ts";
import { PickerPopover } from "./picker-popover.tsx";
import type { ReactNode } from "react";
import { TimeList } from "./time-list.tsx";
import { useFieldIds } from "./field-ids.ts";

const TEXT = { placeholder: "Pick a time" } as const;

function shownOf(value: string): string | null {
  if (value === "") {
    return null;
  }
  return value;
}

export function TimeField(parts: InputFieldParts): ReactNode {
  const { onEdit } = parts;
  const ids = useFieldIds(parts);
  const [open, setOpen] = useState(false);
  const handlePick = useCallback(
    (time: string) => {
      onEdit(time);
      setOpen(false);
    },
    [onEdit],
  );
  const shown = shownOf(parts.value);
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel ids={ids} label={parts.label} required={parts.required} />
      <PickerPopover
        ids={ids}
        invalid={parts.error !== null}
        label={parts.label}
        kind="time"
        onOpenChange={setOpen}
        open={open}
        placeholder={TEXT.placeholder}
        spoken={`${parts.label}: ${shown ?? TEXT.placeholder}`}
        text={shown}
      >
        <TimeList onPick={handlePick} selected={parts.value} />
      </PickerPopover>
      <FieldNotes error={parts.error} help={parts.help} ids={ids} />
    </div>
  );
}
