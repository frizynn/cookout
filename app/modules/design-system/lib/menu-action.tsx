import { ITEM } from "./menu-item.ts";
import type { MessageMenuParts } from "./menu-parts.ts";
import type { ReactNode } from "react";
import { useCallback } from "react";

interface MenuActionParts {
  readonly menu: MessageMenuParts;
  readonly onAction: () => void;
  readonly children: ReactNode;
}

export function MenuAction(parts: MenuActionParts): ReactNode {
  const { menu, onAction } = parts;
  const handleClick = useCallback(() => {
    menu.onClose();
    onAction();
  }, [menu, onAction]);
  return (
    <button className={ITEM} onClick={handleClick} role="menuitem" type="button">
      {parts.children}
    </button>
  );
}
