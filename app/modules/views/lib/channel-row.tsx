import { NONE, hasUnread } from "./unread-counts.ts";
import type { UnreadCounts, UnreadState } from "../../unread/index.ts";
import { ChannelBadges } from "./channel-badges.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import { NavLink } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";

interface ChannelRowProps {
  readonly channel: ChannelName;
  readonly open: boolean;
  readonly unread: UnreadState;
}

function countsOf(unread: UnreadState, channel: ChannelName): UnreadCounts {
  if (unread.status !== "loaded") {
    return NONE;
  }
  return unread.channels.get(channel) ?? NONE;
}

export function ChannelRow(props: ChannelRowProps): ReactNode {
  const { channel } = props;
  const counts = countsOf(props.unread, channel);
  return (
    <NavLink
      active={props.open}
      href={hrefOf({ channel, name: "channel" })}
      icon="channel"
      label={`#${channel}`}
      marked={hasUnread(counts)}
    >
      <ChannelBadges counts={counts} />
    </NavLink>
  );
}
