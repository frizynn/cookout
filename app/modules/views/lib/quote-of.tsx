import { MentionText } from "./mention-text.tsx";
import type { Message } from "../../sdk/index.ts";
import { QuoteCard } from "../../design-system/messages.tsx";
import type { ReactNode } from "react";
import { messageHrefOf } from "./message-href.ts";
import { timeOf } from "../../format/index.ts";
import { useAuthor } from "./use-author.ts";
import { useTimeAgo } from "./use-time-ago.ts";

interface QuoteOfProps {
  readonly message: Message;
  readonly me: string;
}

function whereOf(message: Message): string {
  if (message.kind === "reply") {
    return `Reply in #${message.channel}`;
  }
  return `Message in #${message.channel}`;
}

export function QuoteOf(props: QuoteOfProps): ReactNode {
  const { message } = props;
  const author = useAuthor(message.author);
  const ago = useTimeAgo(message.createdAt);
  return (
    <QuoteCard
      agent={author.agent}
      author={author.displayName ?? message.author.name}
      fullTime={timeOf(message.createdAt).full}
      href={messageHrefOf(message)}
      name={message.author.name}
      time={ago}
      where={whereOf(message)}
    >
      <MentionText me={props.me} message={message} />
    </QuoteCard>
  );
}
