import type { EditAction } from "./edit-action.ts";
import { PencilIcon } from "./pencil-icon.tsx";
import type { ReactNode } from "react";
import { Tooltip } from "./tooltip.tsx";
import { useMemo } from "react";

const BUTTON =
  "shrink-0 rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover/name:opacity-100 max-md:p-2 [&>svg]:h-3.5 [&>svg]:w-3.5 max-md:[&>svg]:h-4 max-md:[&>svg]:w-4";

interface NameEditButtonParts {
  readonly edit: EditAction;
}

export function NameEditButton({ edit }: NameEditButtonParts): ReactNode {
  const { label } = edit;
  const lines = useMemo(() => [label], [label]);
  const handleClick = edit.onEdit;
  return (
    <Tooltip lines={lines}>
      <button aria-label={label} className={BUTTON} onClick={handleClick} type="button">
        <PencilIcon />
      </button>
    </Tooltip>
  );
}
