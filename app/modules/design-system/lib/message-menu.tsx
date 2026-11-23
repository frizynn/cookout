import { useCallback, useEffect } from "react";
import type { MessageMenuParts } from "./menu-parts.ts";
import type { ReactNode } from "react";
import { useListener } from "./use-listener.ts";

const TEXT = { label: "Message actions", markUnread: "Mark unread" } as const;

const ESCAPE = "Escape";
const FIRST_ITEM = "[role='menuitem']";
const NOT_TABBED = -1;

const ITEM =
  "block w-full px-3 py-1.5 text-left text-xs text-foreground outline-none hover:bg-accent focus-visible:bg-accent";

interface OpenMenuParts {
  readonly actionHref: string | null;
  readonly actionLabel: string;
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
      <button className={ITEM} onClick={handleMarkUnread} role="menuitem" type="button">
        {TEXT.markUnread}
      </button>
    </div>
  );
}
