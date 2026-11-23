import { BackLink, Card, CardHeader, Heading } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import type { ChannelName } from "../../sdk/index.ts";
import type { Composer } from "../../composer/index.ts";
import { MessageRows } from "./message-rows.tsx";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";

const TEXT = { back: "← Channels" } as const;

interface ChannelProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly composer: Composer;
}

export function ChannelView(props: ChannelProps): ReactNode {
  return (
    <Card>
      <CardHeader>
        <BackLink href={hrefOf({ name: "channels" })}>{TEXT.back}</BackLink>
        <Heading>{`#${props.channel}`}</Heading>
      </CardHeader>
      <MessageRows
        channel={props.channel}
        commands={props.board.commands}
        draft={props.composer.draft(props.channel)}
        messages={props.board.channel(props.channel)}
      />
    </Card>
  );
}
