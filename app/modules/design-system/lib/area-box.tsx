import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useRef } from "react";

interface AreaBoxParts {
  readonly labelled: string;
  readonly value: string;
  readonly limit: number;
  readonly onEdit: (text: string) => void;
}

const ROWS = 4;

function savesOn(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.key === "Enter" && (event.ctrlKey || event.metaKey);
}

export function AreaBox(parts: AreaBoxParts): ReactNode {
  const { onEdit } = parts;
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
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <textarea
        className="field-sizing-content min-h-16 min-w-0 resize-none rounded-md border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-muted-foreground max-md:rounded-[10px] max-md:py-2.5"
        id={parts.labelled}
        maxLength={parts.limit}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        ref={box}
        rows={ROWS}
        value={parts.value}
      />
      <span className="self-end text-xs text-muted-foreground tabular-nums">{`${String(parts.value.length)}/${String(parts.limit)}`}</span>
    </span>
  );
}
