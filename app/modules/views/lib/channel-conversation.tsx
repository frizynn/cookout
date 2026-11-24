import type { Board } from "../../board/index.ts";
import { ChannelConversationPanel } from "./channel-conversation-panel.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import { ConversationMissing } from "./conversation-missing.tsx";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useChannelPosts } from "./use-channel-posts.ts";

const FIRST = 0;

interface ChannelConversationProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly unread: Unread;
  readonly me: string;
}

export function ChannelConversation(props: ChannelConversationProps): ReactNode {
  const { channel } = props;
  const posts = useChannelPosts({ channel, me: props.me, unread: props.unread });
  if (posts === null) {
    return null;
  }
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
