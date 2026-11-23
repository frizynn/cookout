import type { ThreadMessages, ThreadMessagesState } from "../../board/index.ts";
import type { Draft } from "../../composer/index.ts";
import { MessageBox } from "./message-box.tsx";
import type { ReactNode } from "react";

const REPLY_BOX = { button: "Send reply", field: "Reply", form: "Reply to the thread", posts: "reply" } as const;

interface ReplyFooterProps {
  readonly draft: Draft;
  readonly messages: ThreadMessages;
  readonly state: ThreadMessagesState;
}

export function ReplyFooter(props: ReplyFooterProps): ReactNode {
  const { messages, state } = props;
  const handleReply = messages.reply;
  if (state.status !== "loaded") {
    return null;
  }
  return <MessageBox draft={props.draft} focused onPost={handleReply} post={state.reply} text={REPLY_BOX} />;
}
