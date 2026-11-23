import type { PresenceStore, PresenceStoreOptions } from "../../presence-store/index.ts";
import type { Live } from "../../live/index.ts";
import type { Unread } from "../../unread/index.ts";
import { adminClient } from "./identities.ts";
import { createPresenceStore } from "../../presence-store/index.ts";
import { createUnread } from "../../unread/index.ts";

interface PresenceOpening {
  readonly client: PresenceStoreOptions["client"];
  readonly live?: Live | undefined;
  readonly presence?: PresenceStore | undefined;
}

export function presenceFor(opening: PresenceOpening): PresenceStore {
  return opening.presence ?? createPresenceStore({ client: opening.client, live: opening.live ?? null });
}

export function unreadFor(unread: Unread | undefined): Unread {
  return unread ?? createUnread({ client: adminClient() });
}

export { createUnread } from "../../unread/index.ts";
export type { PresenceStore } from "../../presence-store/index.ts";
export type { Unread } from "../../unread/index.ts";
