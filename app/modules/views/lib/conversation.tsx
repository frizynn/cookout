import type { Board, ThreadMessagesState } from "../../board/index.ts";
import { ConversationPanel, ScrollArea } from "../../design-system/index.tsx";
import type { Reader, Reading, Unread } from "../../unread/index.ts";
import { ConversationBody } from "./conversation-body.tsx";
import { ConversationMissing } from "./conversation-missing.tsx";
import type { InboxSelection } from "../../paths/index.ts";
import type { PanelAction } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { ReadNote } from "./read-note.tsx";
import { hrefOf } from "../../paths/index.ts";
import { useSyncExternalStore } from "react";
import { useThreadReader } from "./use-thread-reader.ts";

const TEXT = {
  back: "Back to the inbox",
  conversation: "Conversation",
  markRead: "Mark read",
  markUnread: "Mark unread",
  messages: "The conversation's messages",
  open: "Open thread",
} as const;

const NONE = 0;
const NOT_FOUND = "message_not_found";

interface ConversationProps {
  readonly board: Board;
  readonly selected: InboxSelection;
  readonly unread: Unread;
  readonly reading: Reading;
  readonly me: string;
}

function actionsOf(reader: Reader): readonly PanelAction[] {
  return [
    { label: TEXT.markRead, onAction: reader.markRead },
    { label: TEXT.markUnread, onAction: reader.markUnread },
  ];
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
  const state = useSyncExternalStore(messages.subscribeWithoutAcking, messages.snapshot);
  const reader = useThreadReader(props);
  if (isMissing(state)) {
    return <ConversationMissing />;
  }
  return (
    <ConversationPanel
      actions={actionsOf(reader)}
      backHref={hrefOf({ name: "inbox", selected: null })}
      backLabel={TEXT.back}
      detail={`#${channel}`}
      label={TEXT.conversation}
      openHref={hrefOf({ channel, name: "thread", thread })}
      openLabel={TEXT.open}
    >
      <ReadNote reader={reader} />
      <ScrollArea count={countOf(state)} label={TEXT.messages}>
        <ConversationBody
          closing={props.board.closing}
          me={props.me}
          menu={props.unread.menu}
          readPosition={readPosition}
          selection={props.unread.selection(selected)}
          state={state}
        />
      </ScrollArea>
    </ConversationPanel>
  );
}
