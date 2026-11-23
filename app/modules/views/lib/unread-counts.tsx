import { NONE, mentionsLabel } from "./unread-counts.ts";
import { Count } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import type { UnreadCounts } from "../../unread/index.ts";

interface UnreadCountsProps {
  readonly counts: UnreadCounts;
}

export function UnreadCountBadges(props: UnreadCountsProps): ReactNode {
  const { mentions, plain } = props.counts;
  return (
    <>
      {plain > NONE.plain && <Count count={plain} label={`${String(plain)} unread`} tone="plain" />}
      {mentions > NONE.mentions && <Count count={mentions} label={mentionsLabel(mentions)} tone="mention" />}
    </>
  );
}
