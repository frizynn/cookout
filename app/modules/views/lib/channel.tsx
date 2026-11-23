import { BackLink, Card, CardHeader, Heading } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import type { ChannelName } from "../../sdk/index.ts";
import { MessageRows } from "./message-rows.tsx";
import { NotBuiltView } from "./not-built.tsx";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";
import { useSyncExternalStore } from "react";

const TEXT = { back: "← Channels", missing: "No channel has this name.", nothing: "Nothing here" } as const;

interface ChannelProps {
  readonly board: Board;
  readonly channel: ChannelName;
}

export function ChannelView(props: ChannelProps): ReactNode {
  const messages = props.board.channel(props.channel);
  const state = useSyncExternalStore(messages.subscribe, messages.snapshot);
  if (state.status === "failed" && state.code === "channel_not_found") {
    return <NotBuiltView description={TEXT.missing} title={TEXT.nothing} />;
  }
  return (
    <Card>
      <CardHeader>
        <BackLink href={hrefOf({ name: "channels" })}>{TEXT.back}</BackLink>
        <Heading>{`#${props.channel}`}</Heading>
      </CardHeader>
      <MessageRows channel={props.channel} commands={props.board.commands} messages={messages} />
    </Card>
  );
}
