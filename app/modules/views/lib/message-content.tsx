import type { Message } from "../../sdk/index.ts";
import { MessageData } from "./message-data.tsx";
import { MessageReactions } from "./message-reactions.tsx";
import type { ReactNode } from "react";

interface MessageContentProps {
  readonly me: string;
  readonly message: Message;
}

export function MessageContent(props: MessageContentProps): ReactNode {
  return (
    <>
      <MessageData me={props.me} message={props.message} />
      <MessageReactions me={props.me} message={props.message} />
    </>
  );
}
