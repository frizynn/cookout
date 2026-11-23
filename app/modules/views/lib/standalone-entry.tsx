import type { Message } from "../../sdk/index.ts";
import { MessageData } from "./message-data.tsx";
import type { ReactNode } from "react";
import { StandaloneMessage } from "../../design-system/index.tsx";
import { dayLabel } from "../../format/index.ts";
import { markOf } from "./message-marks.ts";
import { useAuthor } from "./use-author.ts";
import { useMessageTime } from "./use-time-ago.ts";

const NO_ACTION = "";

interface StandaloneEntryProps {
  readonly message: Message;
  readonly me: string;
  readonly label: string;
}

export function StandaloneEntry(props: StandaloneEntryProps): ReactNode {
  const { message } = props;
  const { agent, displayName, note, profileHref } = useAuthor(message.author);
  return (
    <StandaloneMessage
      actionHref={null}
      actionLabel={NO_ACTION}
      agent={agent}
      displayName={displayName}
      day={dayLabel(message.createdAt)}
      grouped={false}
      label={props.label}
      mark={markOf({ me: props.me, message, open: null, parent: null })}
      name={message.author.name}
      nameHref={profileHref}
      note={note}
      time={useMessageTime(message.createdAt)}
      unreadLine={false}
    >
      <MessageData me={props.me} message={message} />
    </StandaloneMessage>
  );
}
