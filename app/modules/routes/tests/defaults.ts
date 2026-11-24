import type { PresenceStore, PresenceStoreOptions } from "../../presence-store/index.ts";
import type { Reading, Unread } from "../../unread/index.ts";
import { createReading, createUnread } from "../../unread/index.ts";
import type { Live } from "../../live/index.ts";
import { adminClient } from "./identities.ts";
import { createPageFocus } from "../../page-focus/index.ts";
import { createPresenceStore } from "../../presence-store/index.ts";
import { handClock } from "./hand-clock.ts";
import { handFocus } from "../../testing/web.ts";

interface PresenceOpening {
  readonly client: PresenceStoreOptions["client"];
  readonly live?: Live | undefined;
  readonly presence?: PresenceStore | undefined;
}

export function presenceFor(opening: PresenceOpening): PresenceStore {
  return opening.presence ?? createPresenceStore({ client: opening.client, live: opening.live ?? null });
}

export function readingFor(reading: Reading | undefined): Reading {
  return reading ?? createReading({ clock: handClock().clock, page: createPageFocus(handFocus().adapter) });
}

export function unreadFor(unread: Unread | undefined): Unread {
  return unread ?? createUnread({ client: adminClient() });
}

export { createUnread } from "../../unread/index.ts";
export type { PresenceStore } from "../../presence-store/index.ts";
export type { Unread } from "../../unread/index.ts";
export type { Reading } from "../../unread/index.ts";
