import type { Message } from "../../sdk/index.ts";
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
    </>
  );
}
