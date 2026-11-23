import type { ReactNode } from "react";
import { useCallback } from "react";

interface OptionParts {
  readonly option: string;
  readonly onChoose: (option: string) => void;
}

export function SuggestionOption(parts: OptionParts): ReactNode {
  const { onChoose, option } = parts;
  const handleClick = useCallback(() => {
    onChoose(option);
  }, [onChoose, option]);
  return (
    <li>
      <button
        className="w-full px-3 py-1.5 text-left text-foreground hover:bg-muted focus:bg-muted focus:outline-none"
        onClick={handleClick}
        type="button"
      >
        {option}
      </button>
    </li>
  );
}
