import { useCallback, useEffect } from "react";
import { ITEM } from "./menu-item.ts";
import { MenuAction } from "./menu-action.tsx";
import type { MessageMenuParts } from "./menu-parts.ts";
import type { ReactNode } from "react";
import { useListener } from "./use-listener.ts";

const TEXT = { label: "Message actions", markUnread: "Mark unread" } as const;

const ESCAPE = "Escape";
const FIRST_ITEM = "[role='menuitem']";
const NOT_TABBED = -1;

interface OpenMenuParts {
  readonly actionHref: string | null;
  readonly actionLabel: string;
  readonly onAction: (() => void) | null;
  readonly menu: MessageMenuParts;
}

export function MessageMenu(parts: OpenMenuParts): ReactNode {
  const { menu } = parts;
  const escaped = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === ESCAPE) {
        menu.onClose();
      }
    },
    [menu],
  );
  const box = useListener<HTMLDivElement, "keydown">({ listener: escaped, type: "keydown" });
  useEffect(() => {
    const shown = box.current;
    if (shown !== null) {
      const first = shown.querySelector<HTMLElement>(FIRST_ITEM);
      if (first !== null) {
        first.focus();
      }
    }
  }, [box]);
  const handleClose = menu.onClose;
  const handleMarkUnread = menu.onMarkUnread;
  const handleAction = parts.onAction;
  return (
    <div
      aria-label={TEXT.label}
      className="absolute top-8 right-4 z-30 flex min-w-36 flex-col rounded-md border bg-background py-1 shadow-md"
      ref={box}
      role="menu"
      tabIndex={NOT_TABBED}
    >
      {parts.actionHref !== null && (
        <a className={ITEM} href={parts.actionHref} onClick={handleClose} role="menuitem">
          {parts.actionLabel}
        </a>
      )}
      {parts.actionHref === null && handleAction !== null && (
        <MenuAction menu={menu} onAction={handleAction}>
          {parts.actionLabel}
        </MenuAction>
      )}
      <button className={ITEM} onClick={handleMarkUnread} role="menuitem" type="button">
        {TEXT.markUnread}
      </button>
    </div>
  );
}
