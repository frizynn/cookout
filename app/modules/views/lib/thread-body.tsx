import { Alert, CardBody, Muted, RepliesDivider, Skeleton } from "../../design-system/index.tsx";
import type { MessageId } from "../../sdk/index.ts";
import { MessageStream } from "./message-stream.tsx";
import type { ReactNode } from "react";
import { StandaloneEntry } from "./standalone-entry.tsx";
import type { ThreadMessagesState } from "../../board/index.ts";
import { replies } from "./message-marks.ts";

const NONE = 0;

const TEXT = { empty: "No replies yet.", parent: "Parent message", replies: "Replies" } as const;

interface ThreadBodyProps {
  readonly state: ThreadMessagesState;
  readonly me: string;
  readonly readPosition: MessageId | null;
}

export function ThreadBody(props: ThreadBodyProps): ReactNode {
  const { state } = props;
  if (state.status === "loading") {
    return (
      <CardBody>
        <Skeleton width="short" />
        <Skeleton width="long" />
      </CardBody>
    );
  }
  if (state.status === "failed") {
    return <Alert>{`Couldn't load the thread (${state.code}): ${state.message}`}</Alert>;
  }
  return (
    <>
      <StandaloneEntry label={TEXT.parent} me={props.me} message={state.parent} />
      <RepliesDivider>{replies(state.replies.length)}</RepliesDivider>
      {state.replies.length === NONE && (
        <CardBody>
          <Muted>{TEXT.empty}</Muted>
        </CardBody>
      )}
      <MessageStream
        after={state.parent}
        channel={null}
        label={TEXT.replies}
        me={props.me}
        messages={state.replies}
        open={null}
        readPosition={props.readPosition}
      />
      {state.read.status === "failed" && (
        <Alert>{`Couldn't mark the thread read (${state.read.code}): ${state.read.message}`}</Alert>
      )}
    </>
  );
}
