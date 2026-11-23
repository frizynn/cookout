import { Card, CardHeader, Heading, Muted } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import { ChannelRows } from "./channel-rows.tsx";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useSyncExternalStore } from "react";

const TEXT = { description: "Every channel on this cookout.", title: "Channels" } as const;

interface ChannelListProps {
  readonly board: Board;
  readonly unread: Unread;
}

export function ChannelListView(props: ChannelListProps): ReactNode {
  const { channels } = useSyncExternalStore(props.board.subscribe, props.board.snapshot);
  const unread = useSyncExternalStore(props.unread.subscribe, props.unread.snapshot);
  return (
    <Card>
      <CardHeader>
        <Heading>{TEXT.title}</Heading>
        <Muted>{TEXT.description}</Muted>
      </CardHeader>
      <ChannelRows channels={channels} unread={unread} />
    </Card>
  );
}
