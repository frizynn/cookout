import { useCallback, useId, useRef } from "react";
import type { ReactNode } from "react";

interface LineFormParts {
  readonly label: string;
  readonly field: string;
  readonly value: string;
  readonly saving: boolean;
  readonly onEdit: (text: string) => void;
  readonly onSubmit: () => void;
  readonly children?: ReactNode;
}

const SAVE = "Save";
const SAVING = "Saving…";

export function LineForm(parts: LineFormParts): ReactNode {
  const { onEdit, onSubmit } = parts;
  const id = useId();
  const box = useRef<HTMLInputElement>(null);
  const handleChange = useCallback(() => {
    if (box.current !== null) {
      onEdit(box.current.value);
    }
  }, [onEdit]);
  const submitted = useCallback(() => {
    onSubmit();
  }, [onSubmit]);
  return (
    <form action={submitted} aria-label={parts.label} className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground" htmlFor={id}>
        {parts.field}
      </label>
      <span className="flex gap-2">
        <input
          autoComplete="off"
          className="h-8 min-w-0 flex-1 rounded-md border bg-surface px-3 text-sm text-foreground outline-none focus:border-muted-foreground"
          id={id}
          onChange={handleChange}
          ref={box}
          spellCheck={false}
          type="text"
          value={parts.value}
        />
        <button
          className="rounded-md border bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={parts.saving}
          type="submit"
        >
          {parts.saving && SAVING}
          {!parts.saving && SAVE}
        </button>
      </span>
      {parts.children}
    </form>
  );
}
