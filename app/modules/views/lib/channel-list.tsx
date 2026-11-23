import { Card, CardHeader, Heading, Muted } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import { ChannelRows } from "./channel-rows.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { description: "Every channel on this cookout.", title: "Channels" } as const;

interface ChannelListProps {
  readonly board: Board;
}

export function ChannelListView(props: ChannelListProps): ReactNode {
  const { channels } = useSyncExternalStore(props.board.subscribe, props.board.snapshot);
  return (
    <Card>
      <CardHeader>
        <Heading>{TEXT.title}</Heading>
        <Muted>{TEXT.description}</Muted>
      </CardHeader>
      <ChannelRows channels={channels} />
    </Card>
  );
}
