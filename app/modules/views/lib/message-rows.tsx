import { Alert, CardBody, ChannelStart, Skeleton } from "../../design-system/index.tsx";
import type { ChannelMessages, ChannelMessagesState } from "../../board/index.ts";
import type { ChannelName, MessageId } from "../../sdk/index.ts";
import { MessageStream } from "./message-stream.tsx";
import { Older } from "./older.tsx";
import type { ReactNode } from "react";
import { ReadRefusal } from "./read-refusal.tsx";

const TEXT = { messages: "Messages", start: "This is the start of the channel." } as const;

interface MessageRowsProps {
  readonly channel: ChannelName;
  readonly messages: ChannelMessages;
  readonly state: ChannelMessagesState;
  readonly me: string;
  readonly open: MessageId | null;
  readonly unreadFrom: MessageId | null;
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
      {state.hasMore && <Older older={state.older} onLoad={handleLoad} />}
      {!state.hasMore && <ChannelStart description={TEXT.start} title={`Welcome to #${channel}`} />}
      <MessageStream
        after={null}
        channel={channel}
        label={TEXT.messages}
        me={props.me}
        messages={state.messages}
        open={props.open}
        unreadFrom={props.unreadFrom}
      />
      <ReadRefusal read={state.read} />
    </>
  );
}
