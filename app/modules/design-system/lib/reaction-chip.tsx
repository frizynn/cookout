import type { ReactNode } from "react";

interface ReactionChipParts {
  readonly symbol: string;
  readonly count: number;
  readonly names: readonly string[];
  readonly mine: boolean;
  readonly onToggle: () => void;
}

const NAME_SEPARATOR = ", ";

function chipStyle(mine: boolean): string {
  if (mine) {
    return "border-mention-bar/60 bg-mention-bg text-mention-fg";
  }
  return "bg-background text-muted-foreground hover:text-foreground";
}

export type { ReactionChipParts };

export function ReactionChip(parts: ReactionChipParts): ReactNode {
  const handleToggle = parts.onToggle;
  return (
    <button
      aria-pressed={parts.mine}
      className={`rounded-full border px-2 py-0.5 text-xs tabular-nums transition-colors ${chipStyle(parts.mine)}`}
      onClick={handleToggle}
      title={parts.names.join(NAME_SEPARATOR)}
      type="button"
    >
      {`${parts.symbol} ${String(parts.count)}`}
    </button>
  );
}
