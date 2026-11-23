import { Author } from "../../design-system/index.tsx";
import type { Message } from "../../sdk/index.ts";
import { MessageData } from "./message-data.tsx";
import type { ReactNode } from "react";
import { useAuthor } from "./use-author.ts";

interface MessageTextProps {
  readonly message: Message;
}

export function MessageText(props: MessageTextProps): ReactNode {
  const { message } = props;
  const handle = `@${message.author.name}`;
  const { agent, displayName } = useAuthor(message.author);
  return (
    <>
      {displayName === null && <Author agent={agent} handle={null} name={message.author.name} shown={handle} />}
      {displayName !== null && <Author agent={agent} handle={handle} name={message.author.name} shown={displayName} />}
      <span className="text-sm whitespace-pre-wrap">{message.text}</span>
      <MessageData message={message} />
    </>
  );
}
