import type { ReactNode } from "react";
import { useCallback } from "react";

interface OptionParts {
  readonly option: string;
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
        className={`w-full px-3 py-1.5 text-left text-foreground hover:bg-muted focus:bg-muted focus:outline-none ${optionStyle(parts.highlighted)}`}
        onClick={handleClick}
        type="button"
      >
        {option}
      </button>
    </li>
  );
}
