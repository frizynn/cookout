import { Alert, FeedHeading, FeedList, FeedNote, Skeleton } from "../../design-system/index.tsx";
import { InboxItemRow } from "./inbox-item-row.tsx";
import type { ReactNode } from "react";
import type { UnreadState } from "../../unread/index.ts";

const NONE = 0;

const TEXT = { empty: "You're all caught up.", title: "Unread" } as const;

interface InboxBodyProps {
  readonly unread: UnreadState;
  readonly me: string;
}

export function InboxBody(props: InboxBodyProps): ReactNode {
  const { unread } = props;
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
  const items = unread.items.toReversed();
  return (
    <>
      <FeedHeading count={items.length} title={TEXT.title} />
      {items.length === NONE && <FeedNote place="empty">{TEXT.empty}</FeedNote>}
      {items.length > NONE && (
        <FeedList label={TEXT.title}>
          {items.map((item) => (
            <InboxItemRow item={item} key={item.message.id} me={props.me} unread />
          ))}
        </FeedList>
      )}
    </>
  );
}
