import type { ChannelName, Message, MessageId } from "../../sdk/index.ts";
import type { MessageMenu, ThreadNews } from "../../unread/index.ts";
import { MessageEntry } from "./message-entry.tsx";
import { MessageList } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { streamRows } from "./stream-rows.ts";

interface MessageStreamProps {
  readonly label: string;
  readonly messages: readonly Message[];
  readonly me: string;
  readonly readPosition: MessageId | null;
  readonly after: Message | null;
  readonly channel: ChannelName | null;
  readonly open: MessageId | null;
  readonly threads: ReadonlyMap<MessageId, ThreadNews>;
  readonly menu: MessageMenu;
}

export function MessageStream(props: MessageStreamProps): ReactNode {
  const rows = streamRows({
    after: props.after,
    me: props.me,
    messages: props.messages,
    readPosition: props.readPosition,
  });
  return (
    <MessageList label={props.label}>
      {rows.map((row) => (
        <MessageEntry
          channel={props.channel}
          key={row.message.id}
          me={props.me}
          menu={props.menu}
          news={props.threads.get(row.message.id) ?? null}
          open={props.open}
          parent={props.after}
          row={row}
        />
      ))}
    </MessageList>
  );
}
