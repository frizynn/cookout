import { BellIcon } from "./bell-icon.tsx";
import { BellOffIcon } from "./bell-off-icon.tsx";
import { ClockIcon } from "./clock-icon.tsx";
import { GearIcon } from "./gear-icon.tsx";
import { HashIcon } from "./hash-icon.tsx";

export const CHANNEL_MENU_ICONS = {
  "open-in-channel": HashIcon,
  schedule: ClockIcon,
  settings: GearIcon,
  subscribe: BellIcon,
  unsubscribe: BellOffIcon,
} as const;
