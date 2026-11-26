import type { ChoiceFieldParts } from "./option-rows-parts.ts";
import { ChoiceGroup } from "./choice-group.tsx";
import type { ReactNode } from "react";

export function ChoiceField(parts: ChoiceFieldParts): ReactNode {
  const handleChoose = parts.onChoose;
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden className="text-xs font-medium text-foreground max-md:text-[13px]">
        {parts.label}
      </span>
      <ChoiceGroup choices={parts.choices} label={parts.label} onChoose={handleChoose} value={parts.value} />
      {parts.help !== null && <span className="text-xs text-muted-foreground">{parts.help}</span>}
    </div>
  );
}
