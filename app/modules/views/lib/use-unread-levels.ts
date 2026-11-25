import type { ChannelName, MessageId } from "../../sdk/index.ts";
import type { ThreadNews, Unread, UnreadCounts, UnreadState } from "../../unread/index.ts";
import { inboxCounts, inboxCountsByChannel, inboxNewsByThread } from "../../board/index.ts";
import { besideCountOf } from "./beside-count.ts";
import { useBoardInbox } from "./use-board-inbox.ts";
import { useMemo } from "react";

const NONE_BESIDE = 0;

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

function useThreadNews({ me }: Looking): ReadonlyMap<MessageId, ThreadNews> {
  return useBoardInbox((state) => inboxNewsByThread({ me, state }));
}

function besidesOf(state: UnreadState): number {
  if (state.status !== "loaded") {
    return NONE_BESIDE;
  }
  return besideCountOf(state);
}

function useSidebarCounts({ me, state }: Counting): SidebarCounts {
  const counts = useBoardInbox((board) => inboxCounts({ me, state: board }));
  const channels = useBoardInbox((board) => inboxCountsByChannel({ me, state: board }));
  return useMemo(
    () => ({ channels, inbox: { ...counts, forYou: counts.forYou + besidesOf(state) } }),
    [channels, counts, state],
  );
}

export { type Looking, useSidebarCounts, useThreadNews };
