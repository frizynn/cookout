import { LinkRow, Muted } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import type { TopLevelMessage } from "../../sdk/index.ts";

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
  readonly channel: string;
  readonly message: TopLevelMessage;
}

function replies(count: number): string {
  return `${String(count)} ${REPLIES[plural.select(count)]}`;
}

export function MessageRow(props: MessageRowProps): ReactNode {
  const { channel, message } = props;
  return (
    <LinkRow href={`#/channels/${channel}/threads/${String(message.id)}`}>
      <span className="text-xs font-semibold">{`@${message.author.name}`}</span>
      <span className="text-sm whitespace-pre-wrap">{message.text}</span>
      <Muted>{replies(message.replyCount)}</Muted>
    </LinkRow>
  );
}
