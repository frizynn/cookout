import { useCallback, useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { TextAreaParts } from "./parts.ts";
import { useBoxKeys } from "./box-keys.ts";

const ROWS = 3;

export function TextArea(parts: TextAreaParts): ReactNode {
  const { caret, choosing, onClose, onEdit, onMove, onPick, value } = parts;
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const typed = useRef({ caret, value });
  const handleEdit = useCallback(() => {
    const element = box.current;
    if (element !== null) {
      typed.current = { caret: element.selectionStart, value: element.value };
      onEdit(element.value, element.selectionStart);
    }
  }, [onEdit]);
  const handleSend = useCallback(() => {
    const element = box.current;
    if (element !== null && element.form !== null) {
      element.form.requestSubmit();
    }
  }, []);
  const handleKeyDown = useBoxKeys({ choosing, onClose, onMove, onPick, onSend: handleSend });
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null || (typed.current.value === value && typed.current.caret === caret)) {
      return;
    }
    typed.current = { caret, value };
    element.focus();
    element.setSelectionRange(caret, caret);
  }, [caret, value]);
  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <label htmlFor={id}>{parts.label}</label>
      <textarea
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-muted-foreground"
        id={id}
        name={parts.name}
        onChange={handleEdit}
        onKeyDown={handleKeyDown}
        onSelect={handleEdit}
        ref={box}
        required
        rows={ROWS}
        value={value}
      />
    </div>
  );
}
