import { Alert, Skeleton } from "../../design-system/content.tsx";
import type { ChannelActions } from "./use-channel-menu.ts";
import { ChannelList } from "./channel-list.tsx";
import { ChannelMenuRefusal } from "./channel-menu-refusal.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import type { ChannelsState } from "../../board/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import type { UnreadCounts } from "../../unread/index.ts";

interface ChannelRowsProps {
  readonly actions: ChannelActions;
  readonly channels: ChannelsState;
  readonly route: Route;
  readonly counts: ReadonlyMap<ChannelName, UnreadCounts>;
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
    <>
      <ChannelList actions={props.actions} channels={channels} counts={props.counts} route={props.route} />
      <ChannelMenuRefusal actions={props.actions} />
    </>
  );
}
