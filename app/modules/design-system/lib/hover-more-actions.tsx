import type { MenuChoice } from "./menu-parts.ts";
import { MoreActions } from "./more-actions.tsx";
import type { ReactNode } from "react";

interface HoverMoreActionsParts {
  readonly choices: readonly MenuChoice[];
}

export function HoverMoreActions(parts: HoverMoreActionsParts): ReactNode {
  return (
    <div className="invisible absolute top-1/2 right-3 -translate-y-1/2 group-focus-within/actions:visible group-hover/actions:visible has-data-[state=open]:visible">
      <MoreActions choices={parts.choices} />
    </div>
  );
}
