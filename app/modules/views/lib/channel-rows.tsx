import { Alert, LinkList, Skeleton } from "../../design-system/index.tsx";
import { ChannelRow } from "./channel-row.tsx";
import type { ChannelsState } from "../../board/index.ts";
import type { ReactNode } from "react";
import type { UnreadState } from "../../unread/index.ts";

interface ChannelRowsProps {
  readonly channels: ChannelsState;
  readonly unread: UnreadState;
}

export function ChannelRows(props: ChannelRowsProps): ReactNode {
  const { channels, unread } = props;
  if (channels.status === "loading") {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton width="short" />
        <Skeleton width="long" />
      </div>
    );
  }
  if (channels.status === "failed") {
    return <Alert>{`Couldn't load the channels (${channels.code}): ${channels.message}`}</Alert>;
  }
  return (
    <LinkList label="Channels">
      {channels.channels.map((channel) => (
        <ChannelRow channel={channel} key={channel.name} unread={unread} />
      ))}
    </LinkList>
  );
}
