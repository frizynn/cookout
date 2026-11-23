import type { Message, MessageId } from "../../sdk/index.ts";
import { dayLabel, dayOf, millisOf } from "../../format/index.ts";

const FIVE_MINUTES = 300_000;
const NONE = 0;
const PREVIOUS = 1;

interface StreamRow {
  readonly message: Message;
  readonly grouped: boolean;
  readonly day: string | null;
  readonly unreadLine: boolean;
}

interface StreamOf {
  readonly messages: readonly Message[];
  readonly after: Message | null;
  readonly unreadFrom: MessageId | null;
}

function hasReplies(message: Message): boolean {
  return message.kind === "top-level" && message.replyCount > NONE;
}

function joins(previous: Message | null, message: Message): boolean {
  return (
    previous !== null &&
    previous.author.name === message.author.name &&
    millisOf(message.createdAt) - millisOf(previous.createdAt) < FIVE_MINUTES &&
    !hasReplies(previous)
  );
}

function dayStarted(before: Message | null, message: Message): string | null {
  if (before !== null && dayOf(before.createdAt) === dayOf(message.createdAt)) {
    return null;
  }
  return dayLabel(message.createdAt);
}

function rowOf(message: Message, previous: Message | null, stream: StreamOf): StreamRow {
  const day = dayStarted(previous ?? stream.after, message);
  const unreadLine = message.id === stream.unreadFrom;
  return { day, grouped: day === null && !unreadLine && joins(previous, message), message, unreadLine };
}

function streamRows(stream: StreamOf): readonly StreamRow[] {
  return stream.messages.map((message, index) => rowOf(message, stream.messages[index - PREVIOUS] ?? null, stream));
}

export { streamRows };
export type { StreamRow };
