import type { IdentityName, Message, ReadReceipt } from "../../sdk/index.ts";
import { receiptIdentitiesOf } from "../../messages/index.ts";
import { timeAgo } from "../../format/index.ts";

interface SeenBy {
  readonly name: IdentityName;
  readonly seenAt: string | null;
}

const NONE = 0;
const SEEN_BY = "Seen by ";
const NOT_SEEN_YET = "Not seen yet: ";
const NAMES_BETWEEN = ", ";
const PARTS_BETWEEN = " · ";

interface ReceiptLineOf {
  readonly message: Message;
  readonly parent: Message | null;
  readonly receipts: readonly ReadReceipt[];
}

function seenBy(receipts: readonly ReadReceipt[], message: Message, name: IdentityName): SeenBy | null {
  const receipt = receipts.find((each) => each.messageId === message.id && each.identity === name && each.seen) ?? null;
  if (receipt === null) {
    return null;
  }
  return { name, seenAt: receipt.seenAt ?? null };
}

function identitiesOf(message: Message, parent: Message | null): readonly IdentityName[] {
  if (parent === null) {
    return receiptIdentitiesOf({ message });
  }
  return receiptIdentitiesOf({ message, parentAuthor: parent.author.name });
}

function seenOne(seen: SeenBy): string {
  if (seen.seenAt === null) {
    return `@${seen.name}`;
  }
  return `@${seen.name} ${timeAgo(seen.seenAt)}`;
}

function seenText(seen: readonly SeenBy[]): readonly string[] {
  if (seen.length === NONE) {
    return [];
  }
  return [`${SEEN_BY}${seen.map((each) => seenOne(each)).join(NAMES_BETWEEN)}`];
}

function unseenText(unseen: readonly IdentityName[]): readonly string[] {
  if (unseen.length === NONE) {
    return [];
  }
  return [`${NOT_SEEN_YET}${unseen.map((name) => `@${name}`).join(NAMES_BETWEEN)}`];
}

function lineOf(seen: readonly SeenBy[], unseen: readonly IdentityName[]): string | null {
  const parts = [...seenText(seen), ...unseenText(unseen)];
  if (parts.length === NONE) {
    return null;
  }
  return parts.join(PARTS_BETWEEN);
}

function receiptLineOf({ message, parent, receipts }: ReceiptLineOf): string | null {
  const seen: SeenBy[] = [];
  const unseen: IdentityName[] = [];
  for (const name of identitiesOf(message, parent)) {
    const shown = seenBy(receipts, message, name);
    if (shown === null) {
      unseen.push(name);
    } else {
      seen.push(shown);
    }
  }
  return lineOf(seen, unseen);
}

export { type ReceiptLineOf, receiptLineOf };
