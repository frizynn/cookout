import type { Reading, Unread } from "../../unread/index.ts";
import type { Board } from "../../board/index.ts";
import { ConversationEmpty } from "../../design-system/index.tsx";
import { ConversationView } from "./conversation.tsx";
import type { InboxSelection } from "../../paths/index.ts";
import type { ReactNode } from "react";

const TEXT = { conversation: "Conversation", pick: "Pick a conversation" } as const;

interface InboxConversationProps {
  readonly board: Board;
  readonly selected: InboxSelection | null;
  readonly unread: Unread;
  readonly reading: Reading;
  readonly me: string;
}

export function InboxConversation(props: InboxConversationProps): ReactNode {
  const { selected } = props;
  if (selected === null) {
    return <ConversationEmpty label={TEXT.conversation}>{TEXT.pick}</ConversationEmpty>;
  }
  return (
    <ConversationView
      board={props.board}
      key={`${selected.channel}/${String(selected.thread)}`}
      me={props.me}
      reading={props.reading}
      selected={selected}
      unread={props.unread}
    />
  );
}
