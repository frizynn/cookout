import { Alert, CardBody, Skeleton } from "../../design-system/index.tsx";
import type { MessageMenu, Selection } from "../../unread/index.ts";
import type { ThreadClosing, ThreadMessagesState } from "../../board/index.ts";
import { ConversationReplies } from "./conversation-replies.tsx";
import type { ReactNode } from "react";
import { StandaloneEntry } from "./standalone-entry.tsx";

const TEXT = { first: "First message" } as const;

interface ConversationBodyProps {
  readonly state: ThreadMessagesState;
  readonly me: string;
  readonly readPosition: number | null;
  readonly menu: MessageMenu;
  readonly closing: ThreadClosing;
  readonly selection: Selection;
}

export function ConversationBody(props: ConversationBodyProps): ReactNode {
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
        closing={props.closing}
        label={TEXT.first}
        me={props.me}
        menu={props.menu}
        message={state.parent}
        receipts={state.receipts}
        reply={null}
      />
      <ConversationReplies
        me={props.me}
        menu={props.menu}
        parent={state.parent}
        readPosition={props.readPosition}
        receipts={state.receipts}
        replies={state.replies}
        selection={props.selection}
      />
    </>
  );
}
