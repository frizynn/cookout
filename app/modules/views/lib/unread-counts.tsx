import { Count } from "../../design-system/index.tsx";
import { NONE } from "./unread-counts.ts";
import type { ReactNode } from "react";
import type { UnreadCounts } from "../../unread/index.ts";

const ONE = 1;

interface UnreadCountsProps {
  readonly counts: UnreadCounts;
}

function mentionsLabel(mentions: number): string {
  if (mentions === ONE) {
    return "1 mention";
  }
  return `${String(mentions)} mentions`;
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
