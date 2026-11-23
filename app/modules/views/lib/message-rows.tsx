import { Alert, CardBody, LinkList, Muted, Skeleton } from "../../design-system/index.tsx";
import type { ChannelMessages, Commands } from "../../board/index.ts";
import type { ChannelName } from "../../sdk/index.ts";
import { CommandForm } from "./command-form.tsx";
import type { Draft } from "../../composer/index.ts";
import { MessageBox } from "./message-box.tsx";
import { MessageRow } from "./message-row.tsx";
import { Older } from "./older.tsx";
import type { ReactNode } from "react";
import { ReadRefusal } from "./read-refusal.tsx";
import { useSyncExternalStore } from "react";

const NONE = 0;

const TEXT = { empty: "No messages yet.", messages: "Messages" } as const;

const MESSAGE_BOX = {
  button: "Send message",
  field: "Message",
  form: "Post to the channel",
  posts: "message",
} as const;

interface MessageRowsProps {
  readonly channel: ChannelName;
  readonly commands: Commands;
  readonly draft: Draft;
  readonly messages: ChannelMessages;
}

export function MessageRows(props: MessageRowsProps): ReactNode {
  const { channel, messages } = props;
  const state = useSyncExternalStore(messages.subscribe, messages.snapshot);
  const handleLoad = messages.loadOlder;
  const handlePost = messages.post;
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
      <MessageBox draft={props.draft} onPost={handlePost} post={state.post} text={MESSAGE_BOX} />
      <CommandForm call={state.call} callData={state.callData} commands={props.commands} messages={messages} />
    </>
  );
}
