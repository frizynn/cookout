import { CardBody, Skeleton } from "../../design-system/index.tsx";
import type { MessageId, TopLevelMessage } from "../../sdk/index.ts";
import type { MessageMenu, ThreadNews } from "../../unread/index.ts";
import { ChannelConversationFailed } from "./channel-conversation-failed.tsx";
import type { MessageBeforeState } from "../../board/index.ts";
import { MessageStream } from "./message-stream.tsx";
import type { ReactNode } from "react";

const POSTS = "Posts";
const NO_THREADS: ReadonlyMap<MessageId, ThreadNews> = new Map();

interface ChannelConversationBodyProps {
  readonly state: MessageBeforeState;
  readonly posts: readonly TopLevelMessage[];
  readonly me: string;
  readonly menu: MessageMenu;
}

function shownOf(before: TopLevelMessage | null, posts: readonly TopLevelMessage[]): readonly TopLevelMessage[] {
  if (before === null) {
    return posts;
  }
  return [before, ...posts];
}

function idOf(message: TopLevelMessage | null): MessageId | null {
  if (message === null) {
    return null;
  }
  return message.id;
}

export function ChannelConversationBody(props: ChannelConversationBodyProps): ReactNode {
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
    return <ChannelConversationFailed refusal={state} />;
  }
  return (
    <MessageStream
      after={null}
      channel={null}
      label={POSTS}
      me={props.me}
      menu={props.menu}
      messages={shownOf(state.message, props.posts)}
      open={null}
      readPosition={idOf(state.message)}
      receipts={state.receipts}
      reply={null}
      threads={NO_THREADS}
    />
  );
}
