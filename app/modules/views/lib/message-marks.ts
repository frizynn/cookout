import type { ChannelName, Message, MessageId } from "../../sdk/index.ts";
import { hrefOf } from "../../paths/index.ts";

const NONE = 0;

const REPLIES: Readonly<Record<Intl.LDMLPluralRule, string>> = {
  few: "replies",
  many: "replies",
  one: "reply",
  other: "replies",
  two: "replies",
  zero: "replies",
};
const plural = new Intl.PluralRules("en");

function replies(count: number): string {
  return `${String(count)} ${REPLIES[plural.select(count)]}`;
}

interface Marking {
  readonly message: Message;
  readonly me: string;
  readonly open: MessageId | null;
}

interface Linking {
  readonly channel: ChannelName | null;
  readonly message: Message;
}

function markOf({ me, message, open }: Marking): "mention" | "open" | "none" {
  if (message.mentions.some((name) => name === me)) {
    return "mention";
  }
  if (message.id === open) {
    return "open";
  }
  return "none";
}

function threadHref({ channel, message }: Linking): string | null {
  if (channel === null || message.kind !== "top-level") {
    return null;
  }
  return hrefOf({ channel, name: "thread", thread: message.id });
}

function replyCountOf(message: Message): number {
  if (message.kind === "top-level") {
    return message.replyCount;
  }
  return NONE;
}

export { markOf, replies, replyCountOf, threadHref };
