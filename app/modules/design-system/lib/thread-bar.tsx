import type { MenuIcon } from "./menu-icons.ts";
import type { ReactNode } from "react";
import { Tooltip } from "./tooltip.tsx";
import { menuIcon } from "./menu-icons.ts";
import { useMemo } from "react";

const LOOK = [
  "flex shrink-0 items-center gap-3 border-b bg-muted px-5 py-2 text-xs text-muted-foreground",
  "max-md:has-[>p:empty]:absolute max-md:has-[>p:empty]:-top-14 max-md:has-[>p:empty]:right-0 max-md:has-[>p:empty]:h-14",
  "max-md:has-[>p:empty]:border-0 max-md:has-[>p:empty]:bg-transparent max-md:has-[>p:empty]:px-3",
].join(" ");

interface ThreadBarParts {
  readonly actionIcon: MenuIcon;
  readonly actionName: string;
  readonly onAction: () => void;
  readonly children?: ReactNode;
}

export function ThreadBar(parts: ThreadBarParts): ReactNode {
  const { actionName, onAction } = parts;
  const lines = useMemo(() => [actionName], [actionName]);
  return (
    <div className={LOOK}>
      <p className="flex-1">{parts.children}</p>
      <Tooltip lines={lines}>
        <button
          aria-label={actionName}
          className="rounded-md border bg-background px-2.5 py-1 text-foreground hover:bg-accent"
          onClick={onAction}
          type="button"
        >
          {menuIcon(parts.actionIcon)}
        </button>
      </Tooltip>
    </div>
  );
}
