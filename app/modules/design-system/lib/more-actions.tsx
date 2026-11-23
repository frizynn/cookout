import type { MessageMenuParts } from "./menu-parts.ts";
import type { ReactNode } from "react";
import { useCallback } from "react";

const TEXT = { label: "More actions" } as const;

interface MoreActionsParts {
  readonly menu: MessageMenuParts;
}

export function MoreActions(parts: MoreActionsParts): ReactNode {
  const { menu } = parts;
  const handleClick = useCallback(() => {
    if (menu.open) {
      menu.onClose();
      return;
    }
    menu.onOpen();
  }, [menu]);
  return (
    <button
      aria-expanded={menu.open}
      aria-haspopup="menu"
      aria-label={TEXT.label}
      className="block rounded-md border bg-background px-1.5 py-0.5 text-muted-foreground shadow-sm hover:text-foreground focus-visible:text-foreground"
      onClick={handleClick}
      type="button"
    >
      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16">
        <circle cx="3" cy="8" r="1.4" />
        <circle cx="8" cy="8" r="1.4" />
        <circle cx="13" cy="8" r="1.4" />
      </svg>
    </button>
  );
}
