import type { MenuChoice, MessageActionParts, MessageMenuParts } from "./menu-parts.ts";
import { useMemo } from "react";

const TEXT = { markUnread: "Mark unread" } as const;

interface ChoicesOf extends MessageActionParts {
  readonly menu: MessageMenuParts | null;
}

function actionOf(parts: MessageActionParts): readonly MenuChoice[] {
  if (parts.actionHref !== null) {
    return [{ href: parts.actionHref, label: parts.actionLabel, onSelect: null }];
  }
  if (parts.onAction !== null) {
    return [{ href: null, label: parts.actionLabel, onSelect: parts.onAction }];
  }
  return [];
}

export function useMessageChoices({
  actionHref,
  actionLabel,
  menu,
  onAction,
}: ChoicesOf): readonly MenuChoice[] | null {
  return useMemo(() => {
    if (menu === null) {
      return null;
    }
    return [
      ...actionOf({ actionHref, actionLabel, onAction }),
      { href: null, label: TEXT.markUnread, onSelect: menu.onMarkUnread },
    ];
  }, [actionHref, actionLabel, menu, onAction]);
}
