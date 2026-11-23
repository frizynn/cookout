import type { MessageId, ReadReceipt } from "../../sdk/index.ts";

interface Fresh {
  readonly receipts: readonly ReadReceipt[];
  readonly fresh: readonly ReadReceipt[];
}

interface Heard {
  readonly receipts: readonly ReadReceipt[];
  readonly receipt: ReadReceipt;
  readonly holds: (id: MessageId) => boolean;
}

function sameReceipt(one: ReadReceipt, other: ReadReceipt): boolean {
  return one.messageId === other.messageId && one.identity === other.identity;
}

function withReceipts({ fresh, receipts }: Fresh): readonly ReadReceipt[] {
  return [...receipts.filter((held) => !fresh.some((each) => sameReceipt(held, each))), ...fresh];
}

function withHeard({ holds, receipt, receipts }: Heard): readonly ReadReceipt[] {
  if (!holds(receipt.messageId)) {
    return receipts;
  }
  return withReceipts({ fresh: [receipt], receipts });
}

export { withHeard, withReceipts };
