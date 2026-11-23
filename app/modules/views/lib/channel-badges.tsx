import { NONE, mentionsLabel } from "./unread-counts.ts";
import { Pill } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import type { UnreadCounts } from "../../unread/index.ts";

interface ChannelBadgesProps {
  readonly counts: UnreadCounts;
}

export function ChannelBadges(props: ChannelBadgesProps): ReactNode {
  const { mentions, plain } = props.counts;
  return (
    <>
      {plain > NONE.plain && <Pill count={plain} label={`${String(plain)} unread`} tone="unseen" />}
      {mentions > NONE.mentions && <Pill count={mentions} label={mentionsLabel(mentions)} tone="loud" />}
    </>
  );
}
