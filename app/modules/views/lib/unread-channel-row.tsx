import { LinkRow, RowTitle } from "../../design-system/index.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { UnreadCountBadges } from "./unread-counts.tsx";
import type { UnreadCounts } from "../../unread/index.ts";
import { hrefOf } from "../../paths/index.ts";

interface UnreadChannelRowProps {
  readonly channel: ChannelName;
  readonly counts: UnreadCounts;
}

export function UnreadChannelRow(props: UnreadChannelRowProps): ReactNode {
  const { channel, counts } = props;
  return (
    <LinkRow href={hrefOf({ channel, name: "channel" })}>
      <RowTitle marked title={`#${channel}`}>
        <UnreadCountBadges counts={counts} />
      </RowTitle>
    </LinkRow>
  );
}
