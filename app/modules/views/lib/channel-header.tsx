import type { Channel, ChannelName } from "../../sdk/index.ts";
import { ChannelHeaderTools } from "./channel-header-tools.tsx";
import type { Identities } from "../../composer/index.ts";
import { PaneHeader } from "../../design-system/layout.tsx";
import type { ReactNode } from "react";
import type { SubscriptionsState } from "../../board/index.ts";
import { routingNote } from "./routing-note.ts";
import { useChannels } from "./use-board.ts";

interface ChannelHeaderProps {
  readonly channel: ChannelName;
  readonly identities: Identities;
  readonly me: string;
  readonly subscribed: SubscriptionsState;
}

function useFound(name: ChannelName): Channel | null {
  const channels = useChannels();
  if (channels.status !== "loaded") {
    return null;
  }
  return channels.channels.find((channel) => channel.name === name) ?? null;
}

function descriptionOf(channel: Channel | null): string | null {
  if (channel === null || !("description" in channel)) {
    return null;
  }
  return channel.description;
}

export function ChannelHeader(props: ChannelHeaderProps): ReactNode {
  const { channel } = props;
  const found = useFound(channel);
  return (
    <PaneHeader description={descriptionOf(found)} note={routingNote(found)} title={`#${channel}`}>
      <ChannelHeaderTools
        channel={channel}
        found={found}
        identities={props.identities}
        me={props.me}
        subscribed={props.subscribed}
      />
    </PaneHeader>
  );
}
