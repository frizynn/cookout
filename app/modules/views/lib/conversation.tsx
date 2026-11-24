import type { Board, ThreadMessagesState } from "../../board/index.ts";
import { ConversationPanel, ScrollArea } from "../../design-system/index.tsx";
import type { Composer } from "../../composer/index.ts";
import { ConversationBody } from "./conversation-body.tsx";
import { ConversationMissing } from "./conversation-missing.tsx";
import type { ReactNode } from "react";
import { ReplyFooter } from "./reply-footer.tsx";
import type { ThreadSelection } from "../../paths/index.ts";
import type { Unread } from "../../unread/index.ts";
import { hrefOf } from "../../paths/index.ts";
import { threadDraft } from "./thread-draft.ts";
import { useSyncExternalStore } from "react";

const TEXT = {
  back: "Back to the inbox",
  conversation: "Conversation",
  messages: "The conversation's messages",
  open: "Open thread",
  reply: "Reply",
} as const;

const NONE = 0;
const NOT_FOUND = "message_not_found";

interface ConversationProps {
  readonly board: Board;
  readonly composer: Composer;
  readonly selected: ThreadSelection;
  readonly unread: Unread;
  readonly me: string;
}

function countOf(state: ThreadMessagesState): number {
  if (state.status !== "loaded") {
    return NONE;
  }
  return state.replies.length;
}

function isMissing(state: ThreadMessagesState): boolean {
  return state.status === "failed" && state.code === NOT_FOUND;
}

export function ConversationView(props: ConversationProps): ReactNode {
  const { selected } = props;
  const { channel, thread } = selected;
  const line = props.unread.newLine(channel, thread);
  const readPosition = useSyncExternalStore(line.subscribe, line.snapshot);
  const messages = props.board.thread(channel, thread);
  const state = useSyncExternalStore(messages.subscribe, messages.snapshot);
  const draft = threadDraft({ channel, composer: props.composer, me: props.me, messages, thread });
  if (isMissing(state)) {
    return <ConversationMissing />;
  }
  return (
    <ConversationPanel
      backHref={hrefOf({ name: "inbox", selected: null })}
      backLabel={TEXT.back}
      detail={`#${channel}`}
      label={TEXT.conversation}
      openHref={hrefOf({ channel, name: "thread", thread })}
      openLabel={TEXT.open}
    >
      <ScrollArea count={countOf(state)} label={TEXT.messages}>
        <ConversationBody
          closing={props.board.closing}
          me={props.me}
          menu={props.unread.menu}
          readPosition={readPosition}
          reply={draft.replyTo}
          selection={props.unread.selection(selected)}
          state={state}
        />
      </ScrollArea>
      <ReplyFooter draft={draft} field={TEXT.reply} focused={false} messages={messages} state={state} />
    </ConversationPanel>
  );
}
