import type { Board, ThreadMessagesState } from "../../board/index.ts";
import type { ChannelName, MessageId } from "../../sdk/index.ts";
import { ScrollArea, SidePanel } from "../../design-system/index.tsx";
import type { Composer } from "./thread-draft.ts";
import type { ReactNode } from "react";
import { ReplyFooter } from "./reply-footer.tsx";
import { ThreadBody } from "./thread-body.tsx";
import { ThreadClosingBar } from "./thread-closing-bar.tsx";
import type { Unread } from "../../unread/index.ts";
import { hrefOf } from "../../paths/index.ts";
import { threadDraft } from "./thread-draft.ts";
import { useSyncExternalStore } from "react";

const TEXT = { close: "Close panel", replies: "The thread's messages", reply: "Reply", thread: "Thread" } as const;

const NONE = 0;

interface ThreadProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly composer: Composer;
  readonly thread: MessageId;
  readonly unread: Unread;
  readonly me: string;
}

function countOf(state: ThreadMessagesState): number {
  if (state.status !== "loaded") {
    return NONE;
  }
  return state.replies.length;
}

export function ThreadView(props: ThreadProps): ReactNode {
  const { channel } = props;
  const messages = props.board.thread(channel, props.thread);
  const state = useSyncExternalStore(messages.subscribe, messages.snapshot);
  const line = props.unread.newLine(channel, props.thread);
  const readPosition = useSyncExternalStore(line.subscribe, line.snapshot);
  const draft = threadDraft({ channel, composer: props.composer, me: props.me, messages, thread: props.thread });
  return (
    <SidePanel
      closeHref={hrefOf({ channel, name: "channel" })}
      closeLabel={TEXT.close}
      detail={`#${channel}`}
      label={TEXT.thread}
    >
      {state.status === "loaded" && <ThreadClosingBar closing={props.board.closing} parent={state.parent} />}
      <ScrollArea count={countOf(state)} label={TEXT.replies}>
        <ThreadBody
          closing={props.board.closing}
          me={props.me}
          menu={props.unread.menu}
          readPosition={readPosition}
          reply={draft.replyTo}
          state={state}
        />
      </ScrollArea>
      <ReplyFooter draft={draft} field={TEXT.reply} focused messages={messages} state={state} />
    </SidePanel>
  );
}
