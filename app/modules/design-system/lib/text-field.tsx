import type { ReactNode } from "react";
import type { TextFieldParts } from "./parts.ts";
import { useFocusOnOpen } from "./focus-on-open.ts";

export function TextField(parts: TextFieldParts): ReactNode {
  const box = useFocusOnOpen<HTMLInputElement>(parts.focused === true);
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground max-md:text-[13px] max-md:font-medium">
      {parts.label}
      <input
        autoComplete="off"
        className="rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-muted-foreground max-md:rounded-[10px] max-md:font-normal"
        name={parts.name}
        ref={box}
        required
        spellCheck={false}
        type="password"
      />
    </label>
  );
}
