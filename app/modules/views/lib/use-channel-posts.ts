import type { ChannelName, TopLevelMessage } from "../../sdk/index.ts";
import { useMemo, useSyncExternalStore } from "react";
import type { Unread } from "../../unread/index.ts";
import { channelPostsOf } from "./channel-posts.ts";

interface ChannelPosts {
  readonly channel: ChannelName;
  readonly unread: Unread;
  readonly me: string;
}

function useChannelPosts({ channel, me, unread }: ChannelPosts): readonly TopLevelMessage[] | null {
  const selection = unread.selection({ channel, thread: null });
  const { items } = useSyncExternalStore(selection.subscribe, selection.snapshot);
  const earlier = useSyncExternalStore(unread.earlier.subscribe, unread.earlier.snapshot);
  return useMemo(() => channelPostsOf({ channel, earlier, items, me }), [channel, earlier, items, me]);
}

export { useChannelPosts };
