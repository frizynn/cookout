import { Alert, FeedNote, Skeleton } from "../../design-system/index.tsx";
import { InboxAlerts } from "./inbox-alerts.tsx";
import type { InboxRows } from "./use-inbox-rows.ts";
import { InboxSection } from "./inbox-section.tsx";
import type { InboxSelection } from "../../paths/index.ts";
import type { OfflineAlertId } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import type { UnreadState } from "../../unread/index.ts";

const NONE = 0;

const TEXT = { activity: "Activity", empty: "You're all caught up.", forYou: "For you" } as const;

interface InboxBodyProps {
  readonly unread: UnreadState;
  readonly me: string;
  readonly rows: InboxRows;
  readonly selected: InboxSelection | null;
  readonly onMarkAlertRead: (id: OfflineAlertId) => void;
}

export function InboxBody(props: InboxBodyProps): ReactNode {
  const { me, rows, selected, unread } = props;
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
      {unread.inbox.length === NONE && unread.alerts.length === NONE && <FeedNote place="empty">{TEXT.empty}</FeedNote>}
      <InboxAlerts alerts={unread.alerts} onMarkRead={props.onMarkAlertRead} />
      <InboxSection forYou me={me} rows={rows} selected={selected} title={TEXT.forYou} />
      <InboxSection forYou={false} me={me} rows={rows} selected={selected} title={TEXT.activity} />
    </>
  );
}
