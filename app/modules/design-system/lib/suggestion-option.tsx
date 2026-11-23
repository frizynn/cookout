import type { ReactNode } from "react";
import type { SuggestionParts } from "./parts.ts";
import { useCallback } from "react";

interface OptionParts extends SuggestionParts {
  readonly highlighted: boolean;
  readonly onChoose: (option: string) => void;
}

function optionStyle(highlighted: boolean): string {
  if (highlighted) {
    return "bg-muted";
  }
  return "";
}

export function SuggestionOption(parts: OptionParts): ReactNode {
  const { onChoose, option } = parts;
  const handleClick = useCallback(() => {
    onChoose(option);
  }, [onChoose, option]);
  return (
    <li>
      <button
        aria-current={parts.highlighted}
        className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-foreground hover:bg-muted focus:bg-muted focus:outline-none ${optionStyle(parts.highlighted)}`}
        onClick={handleClick}
        type="button"
      >
        <span>{option}</span>
        {parts.detail !== null && <span className="truncate text-xs text-muted-foreground">{parts.detail}</span>}
      </button>
    </li>
  );
}
