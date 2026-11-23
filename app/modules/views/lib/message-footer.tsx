import type { ChannelMessages, ChannelMessagesState, Commands } from "../../board/index.ts";
import { CommandForm } from "./command-form.tsx";
import type { Draft } from "../../composer/index.ts";
import { MessageBox } from "./message-box.tsx";
import type { ReactNode } from "react";

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
  const { messages, state } = props;
  const handlePost = messages.post;
  if (state.status !== "loaded") {
    return null;
  }
  return (
    <>
      <MessageBox draft={props.draft} onPost={handlePost} post={state.post} text={MESSAGE_BOX} />
      <CommandForm call={state.call} callData={state.callData} commands={props.commands} messages={messages} />
    </>
  );
}
