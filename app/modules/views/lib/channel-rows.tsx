import { Alert, NavList, Skeleton } from "../../design-system/index.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import { ChannelRow } from "./channel-row.tsx";
import type { ChannelsState } from "../../board/index.ts";
import type { ReactNode } from "react";
import type { UnreadState } from "../../unread/index.ts";

const TEXT = { channels: "Channels" } as const;

interface ChannelRowsProps {
  readonly channels: ChannelsState;
  readonly open: ChannelName | null;
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
    <NavList label={TEXT.channels}>
      {channels.channels
        .toSorted((first, second) => first.name.localeCompare(second.name))
        .map((channel) => (
          <ChannelRow channel={channel.name} key={channel.name} open={props.open === channel.name} unread={unread} />
        ))}
    </NavList>
  );
}
