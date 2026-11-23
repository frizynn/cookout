import { FeedRow, FeedText } from "../../design-system/index.tsx";
import type { InboxItem } from "../../sdk/index.ts";
import { MentionText } from "./mention-text.tsx";
import type { ReactNode } from "react";
import type { UnreadWhy } from "../../unread/index.ts";
import { hrefOf } from "../../paths/index.ts";
import { useAuthor } from "./use-author.ts";
import { useTimeAgo } from "./use-time-ago.ts";
import { whyOf } from "../../unread/index.ts";

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

function whyText(why: UnreadWhy, item: InboxItem): string {
  if (why === "mentioned-you") {
    return "Mentioned you";
  }
  if (why === "replied-to-you") {
    return "Replied to you";
  }
  if (why === "followed-thread") {
    return "New reply in a thread you follow";
  }
  return `New in #${item.channel.name}`;
}

function levelOf(why: UnreadWhy, unread: boolean): "for-you" | "activity" | "read" {
  if (!unread) {
    return "read";
  }
  if (why === "mentioned-you" || why === "replied-to-you") {
    return "for-you";
  }
  return "activity";
}

export function InboxItemRow(props: InboxItemRowProps): ReactNode {
  const { item } = props;
  const { message } = item;
  const { agent, displayName } = useAuthor(message.author);
  const time = useTimeAgo(message.createdAt);
  const why = whyOf({ item, me: props.me });
  return (
    <FeedRow
      action={ACTIONS[message.kind]}
      agent={agent}
      displayName={displayName}
      author={message.author.name}
      channel={item.channel.name}
      context={contextOf(item)}
      href={linkOf(item)}
      level={levelOf(why, props.unread)}
      time={time}
      why={whyText(why, item)}
    >
      <FeedText unread={props.unread}>
        <MentionText me={props.me} message={message} />
      </FeedText>
    </FeedRow>
  );
}
