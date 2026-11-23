import { Alert, CardBody, Muted, RepliesDivider, Skeleton } from "../../design-system/index.tsx";
import type { MessageMenu, ThreadNews } from "../../unread/index.ts";
import type { MessageId } from "../../sdk/index.ts";
import { MessageStream } from "./message-stream.tsx";
import type { ReactNode } from "react";
import type { Reply } from "./use-message-menu.ts";
import { StandaloneEntry } from "./standalone-entry.tsx";
import type { ThreadMessagesState } from "../../board/index.ts";
import { replies } from "./message-marks.ts";

const NONE = 0;
const NO_THREADS: ReadonlyMap<MessageId, ThreadNews> = new Map();

const TEXT = { empty: "No replies yet.", parent: "Parent message", replies: "Replies" } as const;

interface ThreadBodyProps {
  readonly state: ThreadMessagesState;
  readonly me: string;
  readonly readPosition: number | null;
  readonly menu: MessageMenu;
  readonly reply: Reply;
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
      <StandaloneEntry
        label={TEXT.parent}
        me={props.me}
        menu={props.menu}
        message={state.parent}
        receipts={state.receipts}
        reply={props.reply}
      />
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
        menu={props.menu}
        messages={state.replies}
        open={null}
        readPosition={props.readPosition}
        receipts={state.receipts}
        reply={props.reply}
        threads={NO_THREADS}
      />
      {state.read.status === "failed" && (
        <Alert>{`Couldn't mark the thread read (${state.read.code}): ${state.read.message}`}</Alert>
      )}
    </>
  );
}
