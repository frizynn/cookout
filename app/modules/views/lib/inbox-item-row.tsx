import type { InboxItem, InboxReason } from "../../sdk/index.ts";
import { LinkRow, RowTitle } from "../../design-system/index.tsx";
import { MessageText } from "./message-text.tsx";
import type { ReactNode } from "react";

const REASONS: Readonly<Record<InboxReason, string>> = {
  "followed-thread": "Followed thread",
  mention: "Mention",
  "subscribed-channel": "Subscribed channel",
};

interface InboxItemRowProps {
  readonly item: InboxItem;
}

function hrefOf(item: InboxItem): string {
  const channel = `#/channels/${item.channel.name}`;
  if (item.message.kind === "reply") {
    return `${channel}/threads/${String(item.parent.id)}`;
  }
  return channel;
}

export function InboxItemRow(props: InboxItemRowProps): ReactNode {
  const { item } = props;
  return (
    <LinkRow href={hrefOf(item)}>
      <RowTitle marked title={`#${item.channel.name}`}>
        <span className="text-xs text-muted-foreground">
          {item.reasons.map((reason) => REASONS[reason]).join(", ")}
        </span>
      </RowTitle>
      <MessageText message={item.message} />
    </LinkRow>
  );
}
