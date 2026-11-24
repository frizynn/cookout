import { BellIcon } from "./bell-icon.tsx";
import { BellOffIcon } from "./bell-off-icon.tsx";
import { HashIcon } from "./hash-icon.tsx";

export const CHANNEL_MENU_ICONS = {
  "open-in-channel": HashIcon,
  subscribe: BellIcon,
  unsubscribe: BellOffIcon,
} as const;
