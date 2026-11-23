import type { ReactNode } from "react";
import { ReceiptName } from "../../design-system/index.tsx";
import { SeenAgo } from "./seen-ago.tsx";
import type { SeenBy } from "./receipt-line.ts";
import { useProfileHref } from "./profile-base.ts";

interface SeenReceiptProps {
  readonly seen: SeenBy;
}

export function SeenReceipt({ seen }: SeenReceiptProps): ReactNode {
  const profileOf = useProfileHref();
  return (
    <>
      <ReceiptName href={profileOf(seen.name)}>{`@${seen.name}`}</ReceiptName>
      {seen.seenAt !== null && <SeenAgo at={seen.seenAt} />}
    </>
  );
}
