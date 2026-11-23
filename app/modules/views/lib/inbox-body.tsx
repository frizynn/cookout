import { Alert, FeedNote, Skeleton } from "../../design-system/index.tsx";
import type { InboxItem } from "../../sdk/index.ts";
import { InboxSection } from "./inbox-section.tsx";
import type { ReactNode } from "react";
import type { UnreadState } from "../../unread/index.ts";
import { rowsOf } from "../../unread/index.ts";
import { useMemo } from "react";

const NONE = 0;

const TEXT = { activity: "Activity", empty: "You're all caught up.", forYou: "For you" } as const;

function itemsOf(unread: UnreadState): readonly InboxItem[] {
  if (unread.status === "loaded") {
    return unread.items;
  }
  return [];
}

interface InboxBodyProps {
  readonly unread: UnreadState;
  readonly me: string;
}

export function InboxBody(props: InboxBodyProps): ReactNode {
  const { me, unread } = props;
  const rows = useMemo(() => rowsOf({ items: itemsOf(unread), me }), [unread, me]);
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
      <InboxSection forYou me={me} rows={rows} title={TEXT.forYou} />
      <InboxSection forYou={false} me={me} rows={rows} title={TEXT.activity} />
    </>
  );
}
