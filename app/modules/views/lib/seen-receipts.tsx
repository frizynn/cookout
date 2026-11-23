import { Fragment } from "react";
import type { ReactNode } from "react";
import type { SeenBy } from "./receipt-line.ts";
import { SeenReceipt } from "./seen-receipt.tsx";

const FIRST = 0;
const SEEN_BY = "Seen by ";
const BETWEEN = ", ";

interface SeenReceiptsProps {
  readonly seen: readonly SeenBy[];
}

export function SeenReceipts(props: SeenReceiptsProps): ReactNode {
  return (
    <>
      {SEEN_BY}
      {props.seen.map((seen, index) => (
        <Fragment key={seen.name}>
          {index > FIRST && BETWEEN}
          <SeenReceipt seen={seen} />
        </Fragment>
      ))}
    </>
  );
}
