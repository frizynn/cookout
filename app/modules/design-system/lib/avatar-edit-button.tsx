import type { EditAction } from "./edit-action.ts";
import { PencilBadge } from "./pencil-badge.tsx";
import type { ReactNode } from "react";
import { Tooltip } from "./tooltip.tsx";
import { useMemo } from "react";

interface AvatarEditButtonParts {
  readonly edit: EditAction | null;
  readonly children: ReactNode;
}

function labelOf(edit: EditAction | null): string {
  if (edit === null) {
    return "";
  }
  return edit.label;
}

export function AvatarEditButton({ children, edit }: AvatarEditButtonParts): ReactNode {
  const label = labelOf(edit);
  const lines = useMemo(() => [label], [label]);
  if (edit === null) {
    return children;
  }
  const handleClick = edit.onEdit;
  return (
    <Tooltip lines={lines}>
      <button
        aria-label={edit.label}
        className="group/edit relative h-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={handleClick}
        type="button"
      >
        {children}
        <PencilBadge />
      </button>
    </Tooltip>
  );
}
