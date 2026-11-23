import type { Message } from "../../sdk/index.ts";
import { MessageData } from "./message-data.tsx";
import type { ReactNode } from "react";

interface MessageTextProps {
  readonly message: Message;
}

export function MessageText(props: MessageTextProps): ReactNode {
  const { message } = props;
  return (
    <>
      <span className="text-xs font-semibold">{`@${message.author.name}`}</span>
      <span className="text-sm whitespace-pre-wrap">{message.text}</span>
      <MessageData message={message} />
    </>
  );
}
