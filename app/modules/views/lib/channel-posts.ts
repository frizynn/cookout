import type { ChannelName, InboxItem, TopLevelMessage } from "../../sdk/index.ts";
import { rowKey, rowsOf } from "../../unread/index.ts";
import type { EarlierState } from "../../unread/index.ts";

const NONE = 0;
const NO_ITEMS: readonly InboxItem[] = [];

interface ChannelPostsOf {
  readonly channel: ChannelName;
  readonly items: readonly InboxItem[];
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

function readItems({ channel, earlier, me }: Omit<ChannelPostsOf, "items">): readonly InboxItem[] | null {
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

function channelPostsOf(of: ChannelPostsOf): readonly TopLevelMessage[] | null {
  if (of.items.length > NONE) {
    return postsOf(of.items);
  }
  const read = readItems(of);
  if (read === null) {
    return null;
  }
  return postsOf(read);
}

export { channelPostsOf };
