import { BackLink, Card, CardHeader, Heading } from "../../design-system/index.tsx";
import type { ChannelName, MessageId } from "../../sdk/index.ts";
import type { Board } from "../../board/index.ts";
import type { Composer } from "../../composer/index.ts";
import type { ReactNode } from "react";
import { ThreadBody } from "./thread-body.tsx";
import { hrefOf } from "../../paths/index.ts";

interface ThreadProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly composer: Composer;
  readonly thread: MessageId;
}

export function ThreadView(props: ThreadProps): ReactNode {
  const { channel } = props;
  return (
    <Card>
      <CardHeader>
        <BackLink href={hrefOf({ channel, name: "channel" })}>{`← #${channel}`}</BackLink>
        <Heading>{`Thread in #${channel}`}</Heading>
      </CardHeader>
      <ThreadBody
        draft={props.composer.draft(`${channel}/${String(props.thread)}`)}
        messages={props.board.thread(channel, props.thread)}
      />
    </Card>
  );
}
