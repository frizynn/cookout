import type { ChannelName, TopLevelMessage } from "../../sdk/index.ts";
import { LinkRow, Muted } from "../../design-system/index.tsx";
import { MessageText } from "./message-text.tsx";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";

const REPLIES: Readonly<Record<Intl.LDMLPluralRule, string>> = {
  few: "replies",
  many: "replies",
  one: "reply",
  other: "replies",
  two: "replies",
  zero: "replies",
};
const plural = new Intl.PluralRules("en");

interface MessageRowProps {
  readonly channel: ChannelName;
  readonly message: TopLevelMessage;
}

function replies(count: number): string {
  return `${String(count)} ${REPLIES[plural.select(count)]}`;
}

export function MessageRow(props: MessageRowProps): ReactNode {
  const { channel, message } = props;
  return (
    <LinkRow href={hrefOf({ channel, name: "thread", thread: message.id })}>
      <MessageText message={message} />
      <Muted>{replies(message.replyCount)}</Muted>
    </LinkRow>
  );
}
