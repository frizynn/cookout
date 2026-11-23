import { FeedRow, FeedText, RowButton } from "../../design-system/index.tsx";
import { useCallback, useSyncExternalStore } from "react";
import type { OpenThread } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import type { ThreadClosing } from "../../board/index.ts";
import { hrefOf } from "../../paths/index.ts";
import { onTick } from "./use-time-ago.ts";
import { plainTextOf } from "./markdown-plain-text.ts";
import { timeSince } from "../../format/index.ts";
import { useAuthor } from "./use-author.ts";

const TEXT = { action: "started a thread in", close: "Close" } as const;

interface OpenThreadRowProps {
  readonly closing: ThreadClosing;
  readonly thread: OpenThread;
}

function firstLineOf(text: string): string {
  const [first = ""] = text.trim().split("\n");
  return plainTextOf(first);
}

export function OpenThreadRow(props: OpenThreadRowProps): ReactNode {
  const { closing } = props;
  const { lastActivityAt, message } = props.thread;
  const { agent, displayName, note, presence, profileHref } = useAuthor(message.author);
  const quiet = useSyncExternalStore(onTick, () => timeSince(lastActivityAt));
  const { id } = message;
  const handleClose = useCallback(() => {
    closing.close(id);
  }, [closing, id]);
  return (
    <FeedRow
      action={TEXT.action}
      agent={agent}
      author={message.author.name}
      authorHref={profileHref}
      channel={message.channel}
      context={null}
      count={null}
      displayName={displayName}
      href={hrefOf({ channel: message.channel, name: "thread", thread: id })}
      level="activity"
      note={note}
      presence={presence}
      time=""
      why={`quiet for ${quiet}`}
    >
      <FeedText unread>{firstLineOf(message.text)}</FeedText>
      <RowButton onClick={handleClose}>{TEXT.close}</RowButton>
    </FeedRow>
  );
}
