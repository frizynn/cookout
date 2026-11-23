import { BackLink, Card, CardHeader, Heading } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import type { MessageId } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { ThreadBody } from "./thread-body.tsx";

interface ThreadProps {
  readonly board: Board;
  readonly channel: string;
  readonly thread: MessageId;
}

export function ThreadView(props: ThreadProps): ReactNode {
  const { channel } = props;
  return (
    <Card>
      <CardHeader>
        <BackLink href={`#/channels/${channel}`}>{`← #${channel}`}</BackLink>
        <Heading>{`Thread in #${channel}`}</Heading>
      </CardHeader>
      <ThreadBody messages={props.board.thread(props.thread)} />
    </Card>
  );
}
