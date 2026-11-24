import { BellIcon } from "./bell-icon.tsx";
import { BellOffIcon } from "./bell-off-icon.tsx";
import { CheckCircleIcon } from "./check-circle-icon.tsx";
import { CopyIcon } from "./copy-icon.tsx";
import type { ReactNode } from "react";
import { ReadIcon } from "./read-icon.tsx";
import { ReplyIcon } from "./reply-icon.tsx";
import { RotateIcon } from "./rotate-icon.tsx";
import { SmileIcon } from "./smile-icon.tsx";
import { UnreadIcon } from "./unread-icon.tsx";
import { createElement } from "react";

const MENU_ICONS = {
  close: CheckCircleIcon,
  "copy-link": CopyIcon,
  "mark-read": ReadIcon,
  "mark-unread": UnreadIcon,
  react: SmileIcon,
  reopen: RotateIcon,
  reply: ReplyIcon,
  subscribe: BellIcon,
  unsubscribe: BellOffIcon,
} as const satisfies Readonly<Record<string, () => ReactNode>>;

export type MenuIcon = keyof typeof MENU_ICONS;

export function menuIcon(icon: MenuIcon): ReactNode {
  return createElement(MENU_ICONS[icon]);
}
