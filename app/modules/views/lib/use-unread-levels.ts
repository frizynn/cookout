import type { ChannelName, InboxItem, MessageId } from "../../sdk/index.ts";
import type { ThreadNews, Unread, UnreadCounts, UnreadState } from "../../unread/index.ts";
import { countsByChannel, countsOf, newsByThread } from "../../unread/index.ts";
import { useMemo, useSyncExternalStore } from "react";

const NO_ALERTS = 0;

interface Looking {
  readonly me: string;
  readonly unread: Unread;
}

interface Counting {
  readonly me: string;
  readonly state: UnreadState;
}

interface SidebarCounts {
  readonly channels: ReadonlyMap<ChannelName, UnreadCounts>;
  readonly inbox: UnreadCounts;
}

function itemsOf(state: UnreadState): readonly InboxItem[] {
  if (state.status !== "loaded") {
    return [];
  }
  return state.items;
}

function useThreadNews({ me, unread }: Looking): ReadonlyMap<MessageId, ThreadNews> {
  const state = useSyncExternalStore(unread.subscribe, unread.snapshot);
  return useMemo(() => newsByThread({ items: itemsOf(state), me }), [state, me]);
}

function alertsOf(state: UnreadState): number {
  if (state.status !== "loaded") {
    return NO_ALERTS;
  }
  return state.alerts.length;
}

function useSidebarCounts({ me, state }: Counting): SidebarCounts {
  return useMemo(() => {
    const items = itemsOf(state);
    const inbox = countsOf({ items, me });
    return { channels: countsByChannel({ items, me }), inbox: { ...inbox, forYou: inbox.forYou + alertsOf(state) } };
  }, [state, me]);
}

export { type Looking, useSidebarCounts, useThreadNews };
