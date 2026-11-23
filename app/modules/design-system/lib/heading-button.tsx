import { PlusIcon } from "./plus-icon.tsx";
import type { ReactNode } from "react";

interface HeadingButtonParts {
  readonly label: string;
  readonly expanded: boolean;
  readonly onClick: () => void;
}

export function HeadingButton(parts: HeadingButtonParts): ReactNode {
  const { onClick } = parts;
  return (
    <button
      aria-expanded={parts.expanded}
      aria-label={parts.label}
      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-hover hover:text-foreground"
      onClick={onClick}
      title={parts.label}
      type="button"
    >
      <PlusIcon />
    </button>
  );
}
