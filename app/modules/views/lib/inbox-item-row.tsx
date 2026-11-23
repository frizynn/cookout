import { Badge, BadgeList, FeedRow, FeedText } from "../../design-system/index.tsx";
import type { InboxItem, InboxReason } from "../../sdk/index.ts";
import { MentionText } from "./mention-text.tsx";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";
import { useIsAgent } from "./use-is-agent.ts";
import { useTimeAgo } from "./use-time-ago.ts";

const REASONS: Readonly<Record<InboxReason, { readonly label: string; readonly tone: "mention" | "plain" }>> = {
  "followed-thread": { label: "Thread", tone: "plain" },
  mention: { label: "Mention", tone: "mention" },
  "subscribed-channel": { label: "Channel", tone: "plain" },
};

const ACTIONS = { reply: "replied in a thread in", "top-level": "posted in" } as const;
const CONTEXT_LENGTH = 70;
const START = 0;
const ELLIPSIS = 1;

interface InboxItemRowProps {
  readonly item: InboxItem;
  readonly me: string;
  readonly unread: boolean;
}

function linkOf(item: InboxItem): string {
  const channel = item.channel.name;
  if (item.message.kind === "reply") {
    return hrefOf({ channel, name: "thread", thread: item.parent.id });
  }
  return hrefOf({ channel, name: "channel" });
}

function contextOf(item: InboxItem): string | null {
  if (item.message.kind !== "reply") {
    return null;
  }
  const { text } = item.parent;
  if (text.length <= CONTEXT_LENGTH) {
    return text;
  }
  return `${text.slice(START, CONTEXT_LENGTH - ELLIPSIS)}…`;
}

export function InboxItemRow(props: InboxItemRowProps): ReactNode {
  const { item } = props;
  const { message } = item;
  const agent = useIsAgent(message.author);
  const time = useTimeAgo(message.createdAt);
  return (
    <FeedRow
      action={ACTIONS[message.kind]}
      agent={agent}
      author={message.author.name}
      channel={item.channel.name}
      context={contextOf(item)}
      href={linkOf(item)}
      time={time}
      unread={props.unread}
    >
      <FeedText unread={props.unread}>
        <MentionText me={props.me} text={message.text} />
      </FeedText>
      <BadgeList>
        {item.reasons.map((reason) => (
          <Badge key={reason} tone={REASONS[reason].tone}>
            {REASONS[reason].label}
          </Badge>
        ))}
      </BadgeList>
    </FeedRow>
  );
}
