import type { ChannelName, TopLevelMessage } from "../../sdk/index.ts";
import type { Board } from "../../board/index.ts";
import { ChannelConversationPanel } from "./channel-conversation-panel.tsx";
import { ConversationMissing } from "./conversation-missing.tsx";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useChannelPosts } from "./use-channel-posts.ts";

interface Ends {
  readonly first: TopLevelMessage;
  readonly newest: TopLevelMessage;
}

interface ChannelConversationProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly unread: Unread;
  readonly me: string;
}

function firstOf(ends: Ends | null, post: TopLevelMessage): TopLevelMessage {
  if (ends === null) {
    return post;
  }
  return ends.first;
}

function endsOf(posts: readonly TopLevelMessage[]): Ends | null {
  let ends: Ends | null = null;
  for (const post of posts) {
    ends = { first: firstOf(ends, post), newest: post };
  }
  return ends;
}

export function ChannelConversation(props: ChannelConversationProps): ReactNode {
  const { channel } = props;
  const posts = useChannelPosts({ channel, me: props.me, unread: props.unread });
  if (posts === null) {
    return null;
  }
  const ends = endsOf(posts);
  if (ends === null) {
    return <ConversationMissing />;
  }
  return (
    <ChannelConversationPanel
      board={props.board}
      channel={channel}
      first={ends.first}
      newest={ends.newest}
      me={props.me}
      menu={props.unread.menu}
      posts={posts}
    />
  );
}
