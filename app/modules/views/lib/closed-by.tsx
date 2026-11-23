import type { Closing } from "../../messages/index.ts";
import type { ReactNode } from "react";
import { ReceiptName } from "../../design-system/index.tsx";
import { SeenAgo } from "./seen-ago.tsx";
import { useProfileHref } from "./profile-base.ts";

interface ClosedByProps {
  readonly closing: Closing;
}

export function ClosedBy({ closing }: ClosedByProps): ReactNode {
  const profileOf = useProfileHref();
  return (
    <>
      {"Closed by "}
      <ReceiptName href={profileOf(closing.closedBy)}>{`@${closing.closedBy}`}</ReceiptName>
      <SeenAgo at={closing.closedAt} />
    </>
  );
}
