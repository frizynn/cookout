import type { ReactNode } from "react";
import type { TextFieldParts } from "./parts.ts";
import { useFocusOnOpen } from "./focus-on-open.ts";

export function TextField(parts: TextFieldParts): ReactNode {
  const box = useFocusOnOpen<HTMLInputElement>(parts.focused === true);
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground max-md:text-[13px]">
      {parts.label}
      <input
        autoComplete="off"
        className="h-8 rounded-md border bg-surface px-3 text-sm font-normal text-foreground outline-none focus:border-muted-foreground max-md:h-11 max-md:rounded-[10px]"
        name={parts.name}
        ref={box}
        required
        spellCheck={false}
        type="password"
      />
    </label>
  );
}
