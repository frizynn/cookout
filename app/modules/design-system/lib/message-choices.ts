import type { MenuChoice, MessageActionParts, MessageMenuParts } from "./menu-parts.ts";
import { useMemo } from "react";

const TEXT = { markUnread: "Mark unread" } as const;

interface ChoicesOf extends MessageActionParts {
  readonly menu: MessageMenuParts;
}

function actionOf(parts: MessageActionParts): readonly MenuChoice[] {
  if (parts.actionHref !== null) {
    return [{ href: parts.actionHref, label: parts.actionLabel, onSelect: null }];
  }
  return [parts.onAction]
    .filter((action) => action !== null)
    .map((action) => ({ href: null, label: parts.actionLabel, onSelect: action }));
}

export function useMessageChoices({ actionHref, actionLabel, menu, onAction }: ChoicesOf): readonly MenuChoice[] {
  return useMemo(
    () => [
      ...actionOf({ actionHref, actionLabel, onAction }),
      { href: null, label: TEXT.markUnread, onSelect: menu.onMarkUnread },
    ],
    [actionHref, actionLabel, menu, onAction],
  );
}
