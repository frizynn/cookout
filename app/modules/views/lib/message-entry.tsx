import type { ChannelName, MessageId } from "../../sdk/index.ts";
import { markOf, threadHref, threadSummaryOf } from "./message-marks.ts";
import { MessageData } from "./message-data.tsx";
import { MessageItem } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { ReplySummary } from "./reply-summary.tsx";
import type { StreamRow } from "./stream-rows.ts";
import { timeOf } from "../../format/index.ts";
import { useAuthor } from "./use-author.ts";

const REPLY = "Reply";

interface MessageEntryProps {
  readonly row: StreamRow;
  readonly me: string;
  readonly channel: ChannelName | null;
  readonly open: MessageId | null;
}

export function MessageEntry(props: MessageEntryProps): ReactNode {
  const { message } = props.row;
  const { agent, displayName } = useAuthor(message.author);
  const href = threadHref({ channel: props.channel, message });
  const summary = threadSummaryOf(message);
  return (
    <MessageItem
      actionHref={href}
      actionLabel={REPLY}
      agent={agent}
      displayName={displayName}
      day={props.row.day}
      grouped={props.row.grouped}
      mark={markOf({ me: props.me, message, open: props.open })}
      name={message.author.name}
      time={timeOf(message.createdAt)}
      unreadLine={props.row.unreadLine}
    >
      <MessageData me={props.me} message={message} />
      {href !== null && summary !== null && <ReplySummary href={href} summary={summary} />}
    </MessageItem>
  );
}
