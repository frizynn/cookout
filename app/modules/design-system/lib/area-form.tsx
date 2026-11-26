import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useId, useRef } from "react";
import { SECONDARY_BUTTON } from "./button-look.ts";

interface AreaFormParts {
  readonly label: string;
  readonly field: string;
  readonly value: string;
  readonly limit: number;
  readonly saving: boolean;
  readonly onEdit: (text: string) => void;
  readonly onSubmit: () => void;
  readonly children?: ReactNode;
}

const ROWS = 4;
const SAVE = "Save";
const SAVING = "Saving…";

function savesOn(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.key === "Enter" && (event.ctrlKey || event.metaKey);
}

export function AreaForm(parts: AreaFormParts): ReactNode {
  const { onEdit, onSubmit } = parts;
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const handleChange = useCallback(() => {
    if (box.current !== null) {
      onEdit(box.current.value);
    }
  }, [onEdit]);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    const { form } = event.currentTarget;
    if (!savesOn(event) || form === null) {
      return;
    }
    event.preventDefault();
    form.requestSubmit();
  }, []);
  const submitted = useCallback(() => {
    onSubmit();
  }, [onSubmit]);
  return (
    <form action={submitted} aria-label={parts.label} className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground max-md:text-[13px]" htmlFor={id}>
        {parts.field}
      </label>
      <textarea
        className="field-sizing-content min-w-0 resize-none rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-muted-foreground"
        id={id}
        maxLength={parts.limit}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        ref={box}
        rows={ROWS}
        value={parts.value}
      />
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">{`${String(parts.value.length)}/${String(parts.limit)}`}</span>
        <button className={SECONDARY_BUTTON} disabled={parts.saving} type="submit">
          {parts.saving && SAVING}
          {!parts.saving && SAVE}
        </button>
      </span>
      {parts.children}
    </form>
  );
}
