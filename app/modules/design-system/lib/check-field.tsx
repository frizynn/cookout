import { useCallback, useRef } from "react";
import type { CheckFieldParts } from "./parts.ts";
import { FieldLabel } from "./field-label.tsx";
import { FieldNotes } from "./field-notes.tsx";
import type { ReactNode } from "react";
import { useFieldIds } from "./field-ids.ts";

export function CheckField(parts: CheckFieldParts): ReactNode {
  const { onEdit } = parts;
  const ids = useFieldIds(parts);
  const box = useRef<HTMLInputElement>(null);
  const handleChange = useCallback(() => {
    if (box.current !== null) {
      onEdit(box.current.checked);
    }
  }, [onEdit]);
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <input
          aria-describedby={ids.describedBy}
          aria-invalid={parts.error !== null}
          checked={parts.checked}
          className="size-4 accent-foreground"
          id={ids.control}
          onChange={handleChange}
          ref={box}
          type="checkbox"
        />
        <FieldLabel ids={ids} label={parts.label} required={parts.required} />
      </span>
      <FieldNotes error={parts.error} help={parts.help} ids={ids} />
    </div>
  );
}
