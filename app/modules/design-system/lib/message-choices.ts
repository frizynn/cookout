import type { MenuChoice, MessageActionParts, MessageMenuParts, ThreadChoice } from "./menu-parts.ts";
import type { MessageItemParts } from "./parts.ts";
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

export function hoverThread(parts: Pick<MessageItemParts, "menu" | "threadOnHover">): ThreadChoice | null {
  if (!parts.threadOnHover) {
    return null;
  }
  return parts.menu.thread;
}

export function useMessageChoices({ actionHref, actionLabel, menu, onAction }: ChoicesOf): readonly MenuChoice[] {
  return useMemo(
    () => [
      ...actionOf({ actionHref, actionLabel, onAction }),
      ...menu.reactions.map((choice) => ({
        href: null,
        label: `React with ${choice.symbol}`,
        onSelect: choice.onReact,
      })),
      { href: null, label: TEXT.markUnread, onSelect: menu.onMarkUnread },
      ...[menu.thread]
        .filter((choice) => choice !== null)
        .map((choice) => ({ href: null, label: choice.label, onSelect: choice.onSelect })),
    ],
    [actionHref, actionLabel, menu, onAction],
  );
}
