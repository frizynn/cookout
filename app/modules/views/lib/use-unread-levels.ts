import type { ChannelName, MessageId } from "../../sdk/index.ts";
import type { ThreadNews, Unread, UnreadCounts, UnreadState } from "../../unread/index.ts";
import { countsByChannel, countsOf, newsByThread } from "../../unread/index.ts";
import { useMemo, useSyncExternalStore } from "react";

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

const NOTHING_LOADED = { inbox: [], items: [] } as const;

function itemsOf(state: UnreadState): Pick<Extract<UnreadState, { status: "loaded" }>, "inbox" | "items"> {
  if (state.status !== "loaded") {
    return NOTHING_LOADED;
  }
  return state;
}

function useThreadNews({ me, unread }: Looking): ReadonlyMap<MessageId, ThreadNews> {
  const state = useSyncExternalStore(unread.subscribe, unread.snapshot);
  return useMemo(() => newsByThread({ items: itemsOf(state).items, me }), [state, me]);
}

function useSidebarCounts({ me, state }: Counting): SidebarCounts {
  return useMemo(() => {
    const { inbox } = itemsOf(state);
    return { channels: countsByChannel({ items: inbox, me }), inbox: countsOf({ items: inbox, me }) };
  }, [state, me]);
}

export { type Looking, useSidebarCounts, useThreadNews };
