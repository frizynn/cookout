import type { Board, ChannelMessagesState } from "../../board/index.ts";
import { Pane, PaneHeader, ScrollArea } from "../../design-system/index.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import type { Composer } from "../../composer/index.ts";
import { MessageFooter } from "./message-footer.tsx";
import { MessageRows } from "./message-rows.tsx";
import { NotBuiltView } from "./not-built.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { missing: "No channel has this name.", nothing: "Nothing here" } as const;

const NONE = 0;

interface ChannelProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly composer: Composer;
}

function useDescription(board: Board, name: ChannelName): string | null {
  const { channels } = useSyncExternalStore(board.subscribe, board.snapshot);
  if (channels.status !== "loaded") {
    return null;
  }
  for (const channel of channels.channels) {
    if (channel.name === name && "description" in channel) {
      return channel.description;
    }
  }
  return null;
}

function countOf(state: ChannelMessagesState): number {
  if (state.status !== "loaded") {
    return NONE;
  }
  return state.messages.length;
}

export function ChannelView(props: ChannelProps): ReactNode {
  const messages = props.board.channel(props.channel);
  const state = useSyncExternalStore(messages.subscribe, messages.snapshot);
  const description = useDescription(props.board, props.channel);
  if (state.status === "failed" && state.code === "channel_not_found") {
    return <NotBuiltView description={TEXT.missing} title={TEXT.nothing} />;
  }
  return (
    <Pane>
      <PaneHeader description={description} title={`#${props.channel}`} />
      <ScrollArea count={countOf(state)}>
        <MessageRows channel={props.channel} messages={messages} state={state} />
      </ScrollArea>
      <MessageFooter
        commands={props.board.commands}
        draft={props.composer.draft(props.channel)}
        messages={messages}
        state={state}
      />
    </Pane>
  );
}
