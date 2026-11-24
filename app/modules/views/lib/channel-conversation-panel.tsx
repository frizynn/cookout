import type { Board, ThreadMessagesState } from "../../board/index.ts";
import type { ChannelName, ReadReceipt, Reply, TopLevelMessage } from "../../sdk/index.ts";
import { ConversationPanel, ScrollArea } from "../../design-system/index.tsx";
import type { MessageMenu, Selection } from "../../unread/index.ts";
import { ChannelConversationBody } from "./channel-conversation-body.tsx";
import type { Composer } from "./use-channel-reply.ts";
import type { ReactNode } from "react";
import { ReplyFooter } from "./reply-footer.tsx";
import { hrefOf } from "../../paths/index.ts";
import { useChannelReply } from "./use-channel-reply.ts";
import { useSyncExternalStore } from "react";

const TEXT = {
  back: "Back to the inbox",
  conversation: "Conversation",
  messages: "The conversation's messages",
} as const;

interface ChannelConversationPanelProps {
  readonly board: Board;
  readonly composer: Composer;
  readonly selection: Selection;
  readonly channel: ChannelName;
  readonly first: TopLevelMessage;
  readonly newest: TopLevelMessage;
  readonly posts: readonly TopLevelMessage[];
  readonly me: string;
  readonly menu: MessageMenu;
}

interface ThreadReplies {
  readonly replies: readonly Reply[];
  readonly receipts: readonly ReadReceipt[];
}

const NO_REPLIES: ThreadReplies = { receipts: [], replies: [] };

function repliesOf(state: ThreadMessagesState): ThreadReplies {
  if (state.status !== "loaded") {
    return NO_REPLIES;
  }
  return state;
}

export function ChannelConversationPanel(props: ChannelConversationPanelProps): ReactNode {
  const { channel, first, newest, posts } = props;
  const read = props.board.read(newest.id);
  useSyncExternalStore(read.subscribe, read.snapshot);
  const before = props.board.messageBefore({ channel, id: first.id });
  const state = useSyncExternalStore(before.subscribe, before.snapshot);
  const reply = useChannelReply({
    board: props.board,
    channel,
    composer: props.composer,
    me: props.me,
    newest,
    selection: props.selection,
  });
  const thread = repliesOf(reply.state);
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
        <ChannelConversationBody
          me={props.me}
          menu={props.menu}
          post={reply.post}
          posts={posts}
          replies={thread.replies}
          reply={reply.onReply}
          replyReceipts={thread.receipts}
          state={state}
        />
      </ScrollArea>
      <ReplyFooter
        draft={reply.draft}
        field={reply.field}
        focused={false}
        messages={reply.messages}
        state={reply.state}
      />
    </ConversationPanel>
  );
}
