import { useCallback, useRef } from "react";
import type { DataAreaParts } from "./parts.ts";
import type { ReactNode } from "react";

const ROWS = 3;

export function DataArea(parts: DataAreaParts): ReactNode {
  const { onEdit } = parts;
  const box = useRef<HTMLTextAreaElement>(null);
  const handleEdit = useCallback(() => {
    if (box.current !== null) {
      onEdit(box.current.value);
    }
  }, [onEdit]);
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {parts.label}
      <textarea
        autoComplete="off"
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-muted-foreground"
        name={parts.name}
        onChange={handleEdit}
        ref={box}
        required
        rows={ROWS}
        spellCheck={false}
        value={parts.value}
      />
    </label>
  );
}
