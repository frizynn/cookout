import type { InboxItem, InboxReason } from "../../sdk/index.ts";
import { LinkRow, RowTitle } from "../../design-system/index.tsx";
import { MessageText } from "./message-text.tsx";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";

const REASONS: Readonly<Record<InboxReason, string>> = {
  "followed-thread": "Followed thread",
  mention: "Mention",
  "subscribed-channel": "Subscribed channel",
};

interface InboxItemRowProps {
  readonly item: InboxItem;
}

function linkOf(item: InboxItem): string {
  const channel = item.channel.name;
  if (item.message.kind === "reply") {
    return hrefOf({ channel, name: "thread", thread: item.parent.id });
  }
  return hrefOf({ channel, name: "channel" });
}

export function InboxItemRow(props: InboxItemRowProps): ReactNode {
  const { item } = props;
  return (
    <LinkRow href={linkOf(item)}>
      <RowTitle marked title={`#${item.channel.name}`}>
        <span className="text-xs text-muted-foreground">
          {item.reasons.map((reason) => REASONS[reason]).join(", ")}
        </span>
      </RowTitle>
      <MessageText message={item.message} />
    </LinkRow>
  );
}
