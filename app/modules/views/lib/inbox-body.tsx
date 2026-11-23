import { Alert, FeedNote, Skeleton } from "../../design-system/index.tsx";
import { InboxSection } from "./inbox-section.tsx";
import type { ReactNode } from "react";
import type { UnreadState } from "../../unread/index.ts";

const NONE = 0;

const TEXT = { activity: "Activity", empty: "You're all caught up.", forYou: "For you" } as const;

interface InboxBodyProps {
  readonly unread: UnreadState;
  readonly me: string;
}

export function InboxBody(props: InboxBodyProps): ReactNode {
  const { me, unread } = props;
  if (unread.status === "loading") {
    return (
      <>
        <Skeleton width="short" />
        <Skeleton width="long" />
      </>
    );
  }
  if (unread.status === "failed") {
    return <Alert>{`Couldn't load the inbox (${unread.code}): ${unread.message}`}</Alert>;
  }
  return (
    <>
      {unread.items.length === NONE && <FeedNote place="empty">{TEXT.empty}</FeedNote>}
      <InboxSection forYou items={unread.items} me={me} title={TEXT.forYou} />
      <InboxSection forYou={false} items={unread.items} me={me} title={TEXT.activity} />
    </>
  );
}
