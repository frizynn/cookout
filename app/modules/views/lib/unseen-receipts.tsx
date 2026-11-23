import { Fragment } from "react";
import type { IdentityName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { ReceiptName } from "../../design-system/index.tsx";
import { useProfileHref } from "./profile-base.ts";

const FIRST = 0;
const NOT_SEEN_YET = "Not seen yet: ";
const BETWEEN = ", ";

interface UnseenReceiptsProps {
  readonly unseen: readonly IdentityName[];
}

export function UnseenReceipts(props: UnseenReceiptsProps): ReactNode {
  const profileOf = useProfileHref();
  return (
    <>
      {NOT_SEEN_YET}
      {props.unseen.map((name, index) => (
        <Fragment key={name}>
          {index > FIRST && BETWEEN}
          <ReceiptName href={profileOf(name)}>{`@${name}`}</ReceiptName>
        </Fragment>
      ))}
    </>
  );
}
