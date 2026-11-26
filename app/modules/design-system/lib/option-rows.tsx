import { useCallback, useId } from "react";
import { OptionRow } from "./option-row.tsx";
import type { OptionRowsParts } from "./option-rows-parts.ts";
import type { ReactNode } from "react";

export function OptionRows(parts: OptionRowsParts): ReactNode {
  const labelId = useId();
  const { onChoose } = parts;
  const handleChoose = useCallback(
    (value: string) => {
      onChoose(value);
    },
    [onChoose],
  );
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground max-md:text-[13px]" id={labelId}>
        {parts.label}
      </span>
      <div aria-labelledby={labelId} className="flex flex-col gap-0.5 rounded-md border p-1" role="radiogroup">
        {parts.choices.map((choice) => (
          <OptionRow
            choice={choice}
            chosen={choice.name === parts.value}
            key={choice.name}
            name={labelId}
            onChoose={handleChoose}
          />
        ))}
      </div>
    </div>
  );
}
