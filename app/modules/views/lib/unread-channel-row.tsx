import { LinkRow, RowTitle } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { UnreadCountBadges } from "./unread-counts.tsx";
import type { UnreadCounts } from "../../unread/index.ts";

interface UnreadChannelRowProps {
  readonly channel: string;
  readonly counts: UnreadCounts;
}

export function UnreadChannelRow(props: UnreadChannelRowProps): ReactNode {
  const { channel, counts } = props;
  return (
    <LinkRow href={`#/channels/${channel}`}>
      <RowTitle marked title={`#${channel}`}>
        <UnreadCountBadges counts={counts} />
      </RowTitle>
    </LinkRow>
  );
}
