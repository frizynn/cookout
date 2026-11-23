import type { ChannelMessages, ChannelMessagesState, Commands } from "../../board/index.ts";
import { CommandPrompt } from "./command-prompt.tsx";
import { CommandsRefusal } from "./commands-refusal.tsx";
import type { Draft } from "../../composer/index.ts";
import { MessageBox } from "./message-box.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const MESSAGE_BOX = {
  button: "Send message",
  field: "Message",
  form: "Post to the channel",
  posts: "message",
} as const;

interface MessageFooterProps {
  readonly commands: Commands;
  readonly draft: Draft;
  readonly messages: ChannelMessages;
  readonly state: ChannelMessagesState;
}

export function MessageFooter(props: MessageFooterProps): ReactNode {
  const { draft, messages, state } = props;
  const handlePost = messages.post;
  const { command, returned } = useSyncExternalStore(draft.subscribe, draft.snapshot);
  const handleBack = draft.unpick;
  if (state.status !== "loaded") {
    return null;
  }
  return (
    <>
      {command === null && (
        <MessageBox draft={draft} focused={returned} onPost={handlePost} post={state.post} text={MESSAGE_BOX} />
      )}
      {command !== null && (
        <CommandPrompt
          call={state.call}
          callData={state.callData}
          command={command}
          draft={draft}
          messages={messages}
          onBack={handleBack}
        />
      )}
      <CommandsRefusal commands={props.commands} />
    </>
  );
}
