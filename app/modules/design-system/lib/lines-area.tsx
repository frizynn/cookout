import { useCallback, useRef } from "react";
import type { DataAreaParts } from "./parts.ts";
import type { ReactNode } from "react";

const ROWS = 2;

export function LinesArea(parts: DataAreaParts): ReactNode {
  const { onEdit } = parts;
  const box = useRef<HTMLTextAreaElement>(null);
  const handleEdit = useCallback(() => {
    if (box.current !== null) {
      onEdit(box.current.value);
    }
  }, [onEdit]);
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground max-md:text-[13px]">
      {parts.label}
      <textarea
        autoComplete="off"
        className="rounded-md border bg-surface px-3 py-2 font-mono text-sm font-normal text-foreground outline-none focus:border-muted-foreground max-md:rounded-[10px]"
        name={parts.name}
        onChange={handleEdit}
        ref={box}
        rows={ROWS}
        spellCheck={false}
        value={parts.value}
      />
    </label>
  );
}
