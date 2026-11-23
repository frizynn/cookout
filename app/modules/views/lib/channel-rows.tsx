import { Alert, LinkList, LinkRow, Muted, Skeleton } from "../../design-system/index.tsx";
import type { ChannelsState } from "../../board/index.ts";
import type { ReactNode } from "react";

interface ChannelRowsProps {
  readonly channels: ChannelsState;
}

export function ChannelRows(props: ChannelRowsProps): ReactNode {
  const { channels } = props;
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
        <LinkRow href={`#/channels/${channel.name}`} key={channel.name}>
          <span className="text-sm">{`#${channel.name}`}</span>
          {"description" in channel && <Muted>{channel.description}</Muted>}
        </LinkRow>
      ))}
    </LinkList>
  );
}
