import { browserTimeZone, dayText, todayIn } from "../../format/index.ts";
import { useCallback, useState } from "react";
import { Calendar } from "./calendar.tsx";
import { FieldLabel } from "./field-label.tsx";
import { FieldNotes } from "./field-notes.tsx";
import type { InputFieldParts } from "./prompt-parts.ts";
import { PickerPopover } from "./picker-popover.tsx";
import type { ReactNode } from "react";
import { useFieldIds } from "./field-ids.ts";

const TEXT = { placeholder: "Pick a day" } as const;

function shownOf(day: string, today: string): string | null {
  if (day === "") {
    return null;
  }
  return dayText({ day, today });
}

export function DateField(parts: InputFieldParts): ReactNode {
  const { onEdit } = parts;
  const ids = useFieldIds(parts);
  const [open, setOpen] = useState(false);
  const handlePick = useCallback(
    (day: string) => {
      onEdit(day);
      setOpen(false);
    },
    [onEdit],
  );
  const today = todayIn(browserTimeZone());
  const shown = shownOf(parts.value, today);
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel ids={ids} label={parts.label} required={parts.required} />
      <PickerPopover
        ids={ids}
        invalid={parts.error !== null}
        label={parts.label}
        kind="date"
        onOpenChange={setOpen}
        open={open}
        placeholder={TEXT.placeholder}
        spoken={`${parts.label}: ${shown ?? TEXT.placeholder}`}
        text={shown}
      >
        <Calendar onPick={handlePick} selected={parts.value} today={today} />
      </PickerPopover>
      <FieldNotes error={parts.error} help={parts.help} ids={ids} />
    </div>
  );
}
