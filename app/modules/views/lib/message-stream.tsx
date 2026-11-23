import type { ChannelName, Message, MessageId } from "../../sdk/index.ts";
import { MessageEntry } from "./message-entry.tsx";
import { MessageList } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { streamRows } from "./stream-rows.ts";

interface MessageStreamProps {
  readonly label: string;
  readonly messages: readonly Message[];
  readonly me: string;
  readonly unreadFrom: MessageId | null;
  readonly after: Message | null;
  readonly channel: ChannelName | null;
  readonly open: MessageId | null;
}

export function MessageStream(props: MessageStreamProps): ReactNode {
  const rows = streamRows({ after: props.after, messages: props.messages, unreadFrom: props.unreadFrom });
  return (
    <MessageList label={props.label}>
      {rows.map((row) => (
        <MessageEntry channel={props.channel} key={row.message.id} me={props.me} open={props.open} row={row} />
      ))}
    </MessageList>
  );
}
