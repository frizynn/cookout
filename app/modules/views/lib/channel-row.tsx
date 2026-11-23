import { LinkRow, Muted, RowTitle } from "../../design-system/index.tsx";
import { NONE, hasUnread } from "./unread-counts.ts";
import type { UnreadCounts, UnreadState } from "../../unread/index.ts";
import type { Channel } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { UnreadCountBadges } from "./unread-counts.tsx";

interface ChannelRowProps {
  readonly channel: Channel;
  readonly unread: UnreadState;
}

function countsOf(unread: UnreadState, channel: string): UnreadCounts {
  if (unread.status !== "loaded") {
    return NONE;
  }
  return unread.channels.get(channel) ?? NONE;
}

export function ChannelRow(props: ChannelRowProps): ReactNode {
  const { channel } = props;
  const counts = countsOf(props.unread, channel.name);
  return (
    <LinkRow href={`#/channels/${channel.name}`}>
      <RowTitle marked={hasUnread(counts)} title={`#${channel.name}`}>
        <UnreadCountBadges counts={counts} />
      </RowTitle>
      {"description" in channel && <Muted>{channel.description}</Muted>}
    </LinkRow>
  );
}
