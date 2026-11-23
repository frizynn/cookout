import type { ReactNode } from "react";

interface ReactionChipsParts {
  readonly children: ReactNode;
}

export function ReactionChips(parts: ReactionChipsParts): ReactNode {
  return <div className="flex flex-wrap gap-1">{parts.children}</div>;
}
