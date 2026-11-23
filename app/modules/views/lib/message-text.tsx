import { Author } from "../../design-system/index.tsx";
import type { Message } from "../../sdk/index.ts";
import { MessageData } from "./message-data.tsx";
import type { ReactNode } from "react";
import { useIsAgent } from "./use-is-agent.ts";

const NOBODY = "";

interface MessageTextProps {
  readonly message: Message;
}

export function MessageText(props: MessageTextProps): ReactNode {
  const { message } = props;
  const agent = useIsAgent(message.author);
  return (
    <>
      <Author agent={agent} name={message.author.name} shown={`@${message.author.name}`} />
      <MessageData me={NOBODY} message={message} />
    </>
  );
}
