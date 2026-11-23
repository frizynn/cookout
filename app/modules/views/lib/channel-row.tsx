import { Count, LinkRow, Muted, RowTitle } from "../../design-system/index.tsx";
import type { UnreadCounts, UnreadState } from "../../unread/index.ts";
import type { Channel } from "../../sdk/index.ts";
import type { ReactNode } from "react";

interface ChannelRowProps {
  readonly channel: Channel;
  readonly unread: UnreadState;
}

const NONE: UnreadCounts = { mentions: 0, plain: 0 };
const ONE = 1;

function countsOf(unread: UnreadState, channel: string): UnreadCounts {
  if (unread.status !== "loaded") {
    return NONE;
  }
  return unread.channels.get(channel) ?? NONE;
}

function mentionsLabel(mentions: number): string {
  if (mentions === ONE) {
    return "1 mention";
  }
  return `${String(mentions)} mentions`;
}

export function ChannelRow(props: ChannelRowProps): ReactNode {
  const { channel } = props;
  const { mentions, plain } = countsOf(props.unread, channel.name);
  return (
    <LinkRow href={`#/channels/${channel.name}`}>
      <RowTitle marked={mentions + plain > NONE.plain} title={`#${channel.name}`}>
        {plain > NONE.plain && <Count count={plain} label={`${String(plain)} unread`} tone="plain" />}
        {mentions > NONE.mentions && <Count count={mentions} label={mentionsLabel(mentions)} tone="mention" />}
      </RowTitle>
      {"description" in channel && <Muted>{channel.description}</Muted>}
    </LinkRow>
  );
}
