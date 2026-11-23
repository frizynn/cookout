import type { Board, ThreadMessagesState } from "../../board/index.ts";
import type { ChannelName, MessageId } from "../../sdk/index.ts";
import { ScrollArea, SidePanel } from "../../design-system/index.tsx";
import type { Composer } from "../../composer/index.ts";
import type { ReactNode } from "react";
import { ReplyFooter } from "./reply-footer.tsx";
import { ThreadBody } from "./thread-body.tsx";
import { hrefOf } from "../../paths/index.ts";
import { useSyncExternalStore } from "react";

const TEXT = { close: "Close thread", thread: "Thread" } as const;

const NONE = 0;

interface ThreadProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly composer: Composer;
  readonly thread: MessageId;
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
  return (
    <SidePanel
      closeHref={hrefOf({ channel, name: "channel" })}
      closeLabel={TEXT.close}
      detail={`#${channel}`}
      label={TEXT.thread}
    >
      <ScrollArea count={countOf(state)}>
        <ThreadBody state={state} />
      </ScrollArea>
      <ReplyFooter
        draft={props.composer.draft(`${channel}/${String(props.thread)}`)}
        messages={messages}
        state={state}
      />
    </SidePanel>
  );
}
