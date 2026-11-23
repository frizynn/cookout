import type { Message, ReadReceipt } from "../../sdk/index.ts";
import { MessageData } from "./message-data.tsx";
import { MessageReactions } from "./message-reactions.tsx";
import type { ReactNode } from "react";
import { Receipts } from "./receipts.tsx";

interface MessageContentProps {
  readonly me: string;
  readonly message: Message;
  readonly parent: Message | null;
  readonly receipts: readonly ReadReceipt[];
}

export function MessageContent(props: MessageContentProps): ReactNode {
  return (
    <>
      <MessageData me={props.me} message={props.message} />
      <MessageReactions me={props.me} message={props.message} />
      <Receipts message={props.message} parent={props.parent} receipts={props.receipts} />
    </>
  );
}
