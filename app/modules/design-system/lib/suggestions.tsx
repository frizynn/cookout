import type { ReactNode } from "react";
import { SuggestionOption } from "./suggestion-option.tsx";
import type { SuggestionsParts } from "./parts.ts";

export function Suggestions(parts: SuggestionsParts): ReactNode {
  const handleChoose = parts.onChoose;
  return (
    <ul aria-label={parts.label} className="flex flex-col rounded-md border bg-background py-1 text-sm">
      {parts.options.map((option) => (
        <SuggestionOption key={option} onChoose={handleChoose} option={option} />
      ))}
    </ul>
  );
}
