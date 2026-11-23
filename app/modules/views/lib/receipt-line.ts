import type { IdentityName, Message, ReadReceipt } from "../../sdk/index.ts";
import { receiptIdentitiesOf } from "../../messages/index.ts";

interface SeenBy {
  readonly name: IdentityName;
  readonly seenAt: string | null;
}

const NONE = 0;

interface ReceiptLine {
  readonly between: boolean;
  readonly seen: readonly SeenBy[];
  readonly unseen: readonly IdentityName[];
}

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

function lineOf(seen: readonly SeenBy[], unseen: readonly IdentityName[]): ReceiptLine | null {
  if (seen.length === NONE && unseen.length === NONE) {
    return null;
  }
  return { between: seen.length > NONE && unseen.length > NONE, seen, unseen };
}

function receiptLineOf({ message, parent, receipts }: ReceiptLineOf): ReceiptLine | null {
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

export { type SeenBy, receiptLineOf };
