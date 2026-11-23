import { CONTROL, useFieldIds } from "./field-ids.ts";
import { useCallback, useRef } from "react";
import { FieldLabel } from "./field-label.tsx";
import { FieldNotes } from "./field-notes.tsx";
import type { PickFieldParts } from "./parts.ts";
import type { ReactNode } from "react";

const TEXT = { none: "—" } as const;

export function PickField(parts: PickFieldParts): ReactNode {
  const { onEdit } = parts;
  const ids = useFieldIds(parts);
  const select = useRef<HTMLSelectElement>(null);
  const handleChange = useCallback(() => {
    if (select.current !== null) {
      onEdit(select.current.value);
    }
  }, [onEdit]);
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel ids={ids} label={parts.label} required={parts.required} />
      <select
        aria-describedby={ids.describedBy}
        aria-invalid={parts.error !== null}
        className={CONTROL}
        id={ids.control}
        onChange={handleChange}
        ref={select}
        required={parts.required}
        value={parts.value}
      >
        <option value="">{TEXT.none}</option>
        {parts.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FieldNotes error={parts.error} help={parts.help} ids={ids} />
    </div>
  );
}
