import { Alert, CardBody, LinkList, Muted, Skeleton } from "../../design-system/index.tsx";
import type { ChannelMessages, ChannelMessagesState } from "../../board/index.ts";
import type { ChannelName } from "../../sdk/index.ts";
import { MessageRow } from "./message-row.tsx";
import { Older } from "./older.tsx";
import type { ReactNode } from "react";
import { ReadRefusal } from "./read-refusal.tsx";

const NONE = 0;

const TEXT = { empty: "No messages yet.", messages: "Messages" } as const;

interface MessageRowsProps {
  readonly channel: ChannelName;
  readonly messages: ChannelMessages;
  readonly state: ChannelMessagesState;
}

export function MessageRows(props: MessageRowsProps): ReactNode {
  const { channel, messages, state } = props;
  const handleLoad = messages.loadOlder;
  if (state.status === "loading") {
    return (
      <CardBody>
        <Skeleton width="short" />
        <Skeleton width="long" />
      </CardBody>
    );
  }
  if (state.status === "failed") {
    return <Alert>{`Couldn't load the messages (${state.code}): ${state.message}`}</Alert>;
  }
  return (
    <>
      {state.hasMore && (
        <CardBody>
          <Older older={state.older} onLoad={handleLoad} />
        </CardBody>
      )}
      {state.messages.length === NONE && (
        <CardBody>
          <Muted>{TEXT.empty}</Muted>
        </CardBody>
      )}
      <LinkList label={TEXT.messages}>
        {state.messages.map((message) => (
          <MessageRow channel={channel} key={message.id} message={message} />
        ))}
      </LinkList>
      <ReadRefusal read={state.read} />
    </>
  );
}
