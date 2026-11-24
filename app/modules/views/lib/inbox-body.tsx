import { Alert, FeedNote, Skeleton } from "../../design-system/index.tsx";
import type { InboxItem, OfflineAlertId } from "../../sdk/index.ts";
import { ForYouNotices } from "./for-you-notices.tsx";
import { InboxAlerts } from "./inbox-alerts.tsx";
import { InboxSection } from "./inbox-section.tsx";
import type { NoticeActions } from "./for-you-notices.tsx";
import type { ReactNode } from "react";
import type { UnreadState } from "../../unread/index.ts";
import { besideCountOf } from "./beside-count.ts";
import { rowsOf } from "../../unread/index.ts";
import { useMemo } from "react";

const NONE = 0;

const TEXT = { activity: "Activity", empty: "You're all caught up.", forYou: "For you" } as const;

function itemsOf(unread: UnreadState): readonly InboxItem[] {
  if (unread.status === "loaded") {
    return unread.inbox;
  }
  return [];
}

interface InboxBodyProps {
  readonly unread: UnreadState;
  readonly me: string;
  readonly onMarkAlertRead: (id: OfflineAlertId) => void;
  readonly notices: NoticeActions;
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
      {unread.inbox.length + besideCountOf(unread) === NONE && <FeedNote place="empty">{TEXT.empty}</FeedNote>}
      <InboxAlerts alerts={unread.alerts} onMarkRead={props.onMarkAlertRead} />
      <InboxSection
        besides={unread.nudges.length + unread.deactivationOffers.length}
        forYou
        me={me}
        rows={rows}
        title={TEXT.forYou}
      >
        <ForYouNotices actions={props.notices} nudges={unread.nudges} offers={unread.deactivationOffers} />
      </InboxSection>
      <InboxSection besides={NONE} forYou={false} me={me} rows={rows} title={TEXT.activity} />
    </>
  );
}
