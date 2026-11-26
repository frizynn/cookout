import { useCallback, useRef } from "react";
import type { FilterFieldParts } from "./parts.ts";
import type { ReactNode } from "react";

export function FilterField(parts: FilterFieldParts): ReactNode {
  const { onEdit } = parts;
  const box = useRef<HTMLInputElement>(null);
  const handleChange = useCallback(() => {
    if (box.current !== null) {
      onEdit(box.current.value);
    }
  }, [onEdit]);
  return (
    <input
      aria-label={parts.label}
      autoComplete="off"
      className="h-8 w-64 max-w-full rounded-md max-md:h-11 max-md:w-full max-md:basis-full max-md:rounded-[10px] max-md:text-base border bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-muted-foreground"
      onChange={handleChange}
      placeholder={`${parts.label}…`}
      ref={box}
      spellCheck={false}
      type="text"
      value={parts.value}
    />
  );
}
