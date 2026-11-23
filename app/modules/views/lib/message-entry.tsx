import type { ChannelName, Message, MessageId } from "../../sdk/index.ts";
import type { MessageMenu, ThreadNews } from "../../unread/index.ts";
import { markOf, threadHref, threadSummaryOf } from "./message-marks.ts";
import { MessageData } from "./message-data.tsx";
import { MessageItem } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { ReplySummary } from "./reply-summary.tsx";
import { useAuthor } from "./use-author.ts";
import { useMessageMenu } from "./use-message-menu.ts";
import { useMessageTime } from "./use-time-ago.ts";

const REPLY = "Reply";

interface Row {
  readonly message: Message;
  readonly day: string | null;
  readonly grouped: boolean;
  readonly unreadLine: boolean;
}

interface MessageEntryProps {
  readonly row: Row;
  readonly me: string;
  readonly channel: ChannelName | null;
  readonly open: MessageId | null;
  readonly parent: Message | null;
  readonly news: ThreadNews | null;
  readonly menu: MessageMenu;
}

export function MessageEntry(props: MessageEntryProps): ReactNode {
  const { message } = props.row;
  const { agent, displayName, note } = useAuthor(message.author);
  const href = threadHref({ channel: props.channel, message });
  const summary = threadSummaryOf(message);
  const menu = useMessageMenu({ menu: props.menu, messageId: message.id });
  return (
    <MessageItem
      actionHref={href}
      actionLabel={REPLY}
      agent={agent}
      displayName={displayName}
      day={props.row.day}
      grouped={props.row.grouped}
      mark={markOf({ me: props.me, message, open: props.open, parent: props.parent })}
      menu={menu}
      name={message.author.name}
      note={note}
      time={useMessageTime(message.createdAt)}
      unreadLine={props.row.unreadLine}
    >
      <MessageData me={props.me} message={message} />
      {href !== null && summary !== null && <ReplySummary href={href} news={props.news} summary={summary} />}
    </MessageItem>
  );
}
