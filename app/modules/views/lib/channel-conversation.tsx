import type { ChannelName, InboxItem, TopLevelMessage } from "../../sdk/index.ts";
import { useMemo, useSyncExternalStore } from "react";
import type { Board } from "../../board/index.ts";
import { ChannelConversationPanel } from "./channel-conversation-panel.tsx";
import { ConversationMissing } from "./conversation-missing.tsx";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";

const FIRST = 0;

interface ChannelConversationProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly unread: Unread;
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

export function ChannelConversation(props: ChannelConversationProps): ReactNode {
  const { channel } = props;
  const selection = props.unread.selection({ channel, thread: null });
  const { items } = useSyncExternalStore(selection.subscribe, selection.snapshot);
  const posts = useMemo(() => postsOf(items), [items]);
  const first = posts.at(FIRST) ?? null;
  if (first === null) {
    return <ConversationMissing />;
  }
  return (
    <ChannelConversationPanel
      board={props.board}
      channel={channel}
      first={first}
      me={props.me}
      menu={props.unread.menu}
      posts={posts}
    />
  );
}
