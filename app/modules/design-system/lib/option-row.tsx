import { CheckCircleIcon } from "./check-circle-icon.tsx";
import { HarnessMark } from "./harness-mark.tsx";
import type { OptionRowParts } from "./option-rows-parts.ts";
import type { ReactNode } from "react";
import { useCallback } from "react";

function rowLook(chosen: boolean): string {
  if (chosen) {
    return "bg-accent text-foreground";
  }
  return "text-foreground hover:bg-accent/60";
}

export function OptionRow(parts: OptionRowParts): ReactNode {
  const { choice, onChoose } = parts;
  const handleChange = useCallback(() => {
    onChoose(choice.name);
  }, [choice.name, onChoose]);
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded px-2 py-1.5 transition-colors has-focus-visible:ring-1 has-focus-visible:ring-ring ${rowLook(parts.chosen)}`}
    >
      <input
        checked={parts.chosen}
        className="sr-only"
        name={parts.name}
        onChange={handleChange}
        type="radio"
        value={choice.name}
      />
      {typeof choice.mark === "string" && <HarnessMark name={choice.mark} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{choice.label}</span>
        {typeof choice.hint === "string" && <span className="text-xs text-muted-foreground">{choice.hint}</span>}
      </span>
      {parts.chosen && <CheckCircleIcon />}
    </label>
  );
}
