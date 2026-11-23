import type { Message, ReadReceipt } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { ReceiptLine } from "../../design-system/index.tsx";
import { SeenReceipts } from "./seen-receipts.tsx";
import { UnseenReceipts } from "./unseen-receipts.tsx";
import { receiptLineOf } from "./receipt-line.ts";

const NONE = 0;
const BETWEEN = " · ";

interface ReceiptsProps {
  readonly message: Message;
  readonly parent: Message | null;
  readonly receipts: readonly ReadReceipt[];
}

export function Receipts(props: ReceiptsProps): ReactNode {
  const line = receiptLineOf(props);
  if (line === null) {
    return null;
  }
  return (
    <ReceiptLine>
      {line.seen.length > NONE && <SeenReceipts seen={line.seen} />}
      {line.between && BETWEEN}
      {line.unseen.length > NONE && <UnseenReceipts unseen={line.unseen} />}
    </ReceiptLine>
  );
}
