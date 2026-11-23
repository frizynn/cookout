import { ChoiceButton } from "./choice-button.tsx";
import type { ChoiceGroupParts } from "./parts.ts";
import type { ReactNode } from "react";

export function ChoiceGroup(parts: ChoiceGroupParts): ReactNode {
  const handleChoose = parts.onChoose;
  return (
    <fieldset className="flex rounded-md border p-0.5 text-xs">
      <legend className="sr-only">{parts.label}</legend>
      {parts.choices.map((choice) => (
        <ChoiceButton
          chosen={parts.value === choice.value}
          key={choice.value}
          label={choice.label}
          name={parts.label}
          onChoose={handleChoose}
          value={choice.value}
        />
      ))}
    </fieldset>
  );
}
