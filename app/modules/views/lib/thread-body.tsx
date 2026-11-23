import { Alert, Article, CardBody, Muted, Skeleton } from "../../design-system/index.tsx";
import type { Draft } from "../../composer/index.ts";
import { MessageBox } from "./message-box.tsx";
import { MessageText } from "./message-text.tsx";
import type { ReactNode } from "react";
import { Replies } from "./replies.tsx";
import type { ThreadMessages } from "../../board/index.ts";
import { useSyncExternalStore } from "react";

const NONE = 0;

const TEXT = { empty: "No replies yet.", parent: "Parent message" } as const;

const REPLY_BOX = { button: "Send reply", field: "Reply", form: "Reply to the thread", posts: "reply" } as const;

interface ThreadBodyProps {
  readonly draft: Draft;
  readonly messages: ThreadMessages;
}

export function ThreadBody(props: ThreadBodyProps): ReactNode {
  const { messages } = props;
  const state = useSyncExternalStore(messages.subscribe, messages.snapshot);
  const handleReply = messages.reply;
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
      <Article label={TEXT.parent}>
        <MessageText message={state.parent} />
      </Article>
      {state.replies.length === NONE && (
        <CardBody>
          <Muted>{TEXT.empty}</Muted>
        </CardBody>
      )}
      <Replies replies={state.replies} />
      {state.read.status === "failed" && (
        <Alert>{`Couldn't mark the thread read (${state.read.code}): ${state.read.message}`}</Alert>
      )}
      <MessageBox draft={props.draft} onPost={handleReply} post={state.reply} text={REPLY_BOX} />
    </>
  );
}
