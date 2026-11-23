import { useCallback, useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { TextAreaParts } from "./parts.ts";

const ROWS = 3;

export function TextArea(parts: TextAreaParts): ReactNode {
  const { caret, onEdit, value } = parts;
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const handleEdit = useCallback(() => {
    const element = box.current;
    if (element !== null) {
      onEdit(element.value, element.selectionStart);
    }
  }, [onEdit]);
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) {
      return;
    }
    if (element.value === value && element.selectionStart !== caret) {
      element.focus();
      element.setSelectionRange(caret, caret);
    }
  }, [caret, value]);
  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <label htmlFor={id}>{parts.label}</label>
      <textarea
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-muted-foreground"
        id={id}
        name={parts.name}
        onChange={handleEdit}
        onSelect={handleEdit}
        ref={box}
        required
        rows={ROWS}
        value={value}
      />
    </div>
  );
}
