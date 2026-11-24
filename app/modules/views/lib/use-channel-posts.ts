import type { ChannelName, InboxItem, TopLevelMessage } from "../../sdk/index.ts";
import type { EarlierState, Unread } from "../../unread/index.ts";
import { rowKey, rowsOf } from "../../unread/index.ts";
import { useMemo, useSyncExternalStore } from "react";

const NONE = 0;
const NO_ITEMS: readonly InboxItem[] = [];

interface ChannelPosts {
  readonly channel: ChannelName;
  readonly unread: Unread;
  readonly me: string;
}

interface Reading {
  readonly channel: ChannelName;
  readonly earlier: EarlierState;
  readonly me: string;
}

function postsOf(items: readonly InboxItem[]): readonly TopLevelMessage[] {
  const posts: TopLevelMessage[] = [];
  for (const { message } of items) {
    if (message.kind === "top-level") {
      posts.push(message);
    }
  }
  return posts;
}

function readItems({ channel, earlier, me }: Reading): readonly InboxItem[] | null {
  if (earlier.status === "loading") {
    return null;
  }
  if (earlier.status === "failed") {
    return NO_ITEMS;
  }
  const key = rowKey({ channel, thread: null });
  const row = rowsOf({ items: earlier.items, me }).find((each) => each.key === key) ?? null;
  if (row === null) {
    return NO_ITEMS;
  }
  return row.items;
}

function useChannelPosts({ channel, me, unread }: ChannelPosts): readonly TopLevelMessage[] | null {
  const selection = unread.selection({ channel, thread: null });
  const { items } = useSyncExternalStore(selection.subscribe, selection.snapshot);
  const earlier = useSyncExternalStore(unread.earlier.subscribe, unread.earlier.snapshot);
  return useMemo(() => {
    if (items.length > NONE) {
      return postsOf(items);
    }
    const read = readItems({ channel, earlier, me });
    if (read === null) {
      return null;
    }
    return postsOf(read);
  }, [channel, earlier, items, me]);
}

export { useChannelPosts };
