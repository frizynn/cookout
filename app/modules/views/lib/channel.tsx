import { BackLink, Card, CardHeader, Heading } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import { MessageRows } from "./message-rows.tsx";
import type { ReactNode } from "react";

const TEXT = { back: "← Channels" } as const;

interface ChannelProps {
  readonly board: Board;
  readonly channel: string;
}

export function ChannelView(props: ChannelProps): ReactNode {
  return (
    <Card>
      <CardHeader>
        <BackLink href="#/">{TEXT.back}</BackLink>
        <Heading>{`#${props.channel}`}</Heading>
      </CardHeader>
      <MessageRows channel={props.channel} messages={props.board.channel(props.channel)} />
    </Card>
  );
}
