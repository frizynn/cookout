import type { MenuIcon } from "./menu-icons.ts";
import type { ReactNode } from "react";
import { Tooltip } from "./tooltip.tsx";
import { menuIcon } from "./menu-icons.ts";
import { useMemo } from "react";

interface PanelIconAction {
  readonly icon: MenuIcon;
  readonly name: string;
  readonly onAction: () => void;
}

interface PanelIconButtonParts {
  readonly action: PanelIconAction;
}

export function PanelIconButton({ action }: PanelIconButtonParts): ReactNode {
  const { name } = action;
  const lines = useMemo(() => [name], [name]);
  const handleClick = action.onAction;
  return (
    <Tooltip lines={lines}>
      <button
        aria-label={action.name}
        className="order-1 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-md:p-2 [&>svg]:h-3.5 [&>svg]:w-3.5 max-md:[&>svg]:h-4 max-md:[&>svg]:w-4"
        onClick={handleClick}
        type="button"
      >
        {menuIcon(action.icon)}
      </button>
    </Tooltip>
  );
}

export type { PanelIconAction };
