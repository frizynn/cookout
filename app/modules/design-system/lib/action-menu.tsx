import { ActionContextMenu } from "./action-context-menu.tsx";
import type { ActionMenuParts } from "./menu-parts.ts";
import { HoverMoreActions } from "./hover-more-actions.tsx";
import type { ReactNode } from "react";

interface ActionMenuFrame extends ActionMenuParts {
  readonly children: ReactNode;
}

export function ActionMenu(parts: ActionMenuFrame): ReactNode {
  const { choices } = parts;
  return (
    <ActionContextMenu choices={choices} label={parts.label}>
      <div className="group/actions relative flex flex-1">
        {parts.children}
        <HoverMoreActions choices={choices} />
      </div>
    </ActionContextMenu>
  );
}
