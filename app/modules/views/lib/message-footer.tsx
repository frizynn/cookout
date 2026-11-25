import type { ChannelMessagesState, Scheduling } from "../../board/index.ts";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useSyncExternalStore } from "react";
import type { ChannelName } from "../../sdk/index.ts";
import { CommandPrompt } from "./command-prompt.tsx";
import { CommandsRefusal } from "./commands-refusal.tsx";
import type { Draft } from "../../composer/index.ts";
import { MessageBox } from "./message-box.tsx";
import { ScheduleConfirmation } from "./schedule-confirmation.tsx";
import { ScheduleDialog } from "./schedule-dialog.tsx";
import { useBoardStore } from "./use-board.ts";

const MESSAGE_BOX = {
  field: "Message",
  form: "Post to the channel",
  posts: "message",
} as const;

interface MessageFooterProps {
  readonly channel: ChannelName;
  readonly scheduling: Scheduling;
  readonly draft: Draft;
  readonly keymap: ComponentProps<typeof CommandPrompt>["keymap"];
  readonly state: ChannelMessagesState;
}

export function MessageFooter(props: MessageFooterProps): ReactNode {
  const { channel, draft, scheduling, state } = props;
  const store = useBoardStore();
  const handlePost = useCallback(
    (text: string, posted: () => void) => {
      store.channelPages.post(channel, { posted, text });
    },
    [channel, store],
  );
  const { command, returned } = useSyncExternalStore(draft.subscribe, draft.snapshot);
  const handleBack = draft.unpick;
  const handleSaved = draft.clear;
  const handleSchedule = useCallback(() => {
    scheduling.open(channel, draft.snapshot().text);
  }, [channel, draft, scheduling]);
  if (state.status !== "loaded") {
    return null;
  }
  return (
    <>
      {command === null && (
        <MessageBox
          draft={draft}
          focused={returned}
          onPost={handlePost}
          onSchedule={handleSchedule}
          post={state.post}
          text={MESSAGE_BOX}
        />
      )}
      {command !== null && (
        <CommandPrompt
          call={state.call}
          callData={state.callData}
          channel={channel}
          command={command}
          draft={draft}
          keymap={props.keymap}
          onBack={handleBack}
        />
      )}
      <CommandsRefusal />
      <ScheduleConfirmation channel={channel} scheduling={scheduling} />
      <ScheduleDialog channel={channel} onSaved={handleSaved} scheduling={scheduling} />
    </>
  );
}
