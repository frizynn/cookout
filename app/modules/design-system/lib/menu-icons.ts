import { CHANNEL_MENU_ICONS } from "./channel-menu-icons.ts";
import { CheckCircleIcon } from "./check-circle-icon.tsx";
import { PERSON_MENU_ICONS } from "./person-menu-icons.ts";
import type { ReactNode } from "react";
import { ReadIcon } from "./read-icon.tsx";
import { ReplyIcon } from "./reply-icon.tsx";
import { RotateIcon } from "./rotate-icon.tsx";
import { SmileIcon } from "./smile-icon.tsx";
import { UnreadIcon } from "./unread-icon.tsx";
import { createElement } from "react";

const MENU_ICONS = {
  close: CheckCircleIcon,
  "mark-read": ReadIcon,
  "mark-unread": UnreadIcon,
  react: SmileIcon,
  reopen: RotateIcon,
  reply: ReplyIcon,
  ...PERSON_MENU_ICONS,
  ...CHANNEL_MENU_ICONS,
} as const satisfies Readonly<Record<string, () => ReactNode>>;

export type MenuIcon = keyof typeof MENU_ICONS;

export function menuIcon(icon: MenuIcon): ReactNode {
  return createElement(MENU_ICONS[icon]);
}
