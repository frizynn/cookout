import type { ChannelName, TopLevelMessage } from "../../sdk/index.ts";
import { ConversationPanel, ScrollArea } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import { ChannelConversationBody } from "./channel-conversation-body.tsx";
import type { MessageMenu } from "../../unread/index.ts";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";
import { useSyncExternalStore } from "react";

const LAST = -1;
const TEXT = {
  back: "Back to the inbox",
  conversation: "Conversation",
  messages: "The conversation's messages",
} as const;

interface ChannelConversationPanelProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly first: TopLevelMessage;
  readonly posts: readonly TopLevelMessage[];
  readonly me: string;
  readonly menu: MessageMenu;
}

export function ChannelConversationPanel(props: ChannelConversationPanelProps): ReactNode {
  const { channel, first, posts } = props;
  const newest = posts.at(LAST) ?? first;
  const read = props.board.read(newest.id);
  useSyncExternalStore(read.subscribe, read.snapshot);
  const before = props.board.messageBefore({ channel, id: first.id });
  const state = useSyncExternalStore(before.subscribe, before.snapshot);
  return (
    <ConversationPanel
      backHref={hrefOf({ name: "inbox", selected: null })}
      backLabel={TEXT.back}
      detail={`#${channel}`}
      label={TEXT.conversation}
      openHref={hrefOf({ channel, name: "channel" })}
      openLabel={`Open in #${channel}`}
    >
      <ScrollArea count={posts.length} label={TEXT.messages}>
        <ChannelConversationBody me={props.me} menu={props.menu} posts={posts} state={state} />
      </ScrollArea>
    </ConversationPanel>
  );
}
