import { Alert, FeedNote, Skeleton } from "../../design-system/index.tsx";
import type { Nudges, UnreadState } from "../../unread/index.ts";
import { InboxAlerts } from "./inbox-alerts.tsx";
import type { InboxRows } from "./use-inbox-rows.ts";
import { InboxSection } from "./inbox-section.tsx";
import type { InboxSelection } from "../../paths/index.ts";
import type { OfflineAlertId } from "../../sdk/index.ts";
import type { ReactNode } from "react";

const NONE = 0;

const TEXT = { activity: "Activity", empty: "You're all caught up.", forYou: "For you" } as const;
const NO_NUDGES = [] as const;

interface InboxBodyProps {
  readonly unread: UnreadState;
  readonly me: string;
  readonly rows: InboxRows;
  readonly selected: InboxSelection | null;
  readonly onMarkAlertRead: (id: OfflineAlertId) => void;
  readonly nudges: Pick<Nudges, "close" | "markRead">;
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
      {unread.inbox.length + unread.alerts.length + unread.nudges.length === NONE && (
        <FeedNote place="empty">{TEXT.empty}</FeedNote>
      )}
      <InboxAlerts alerts={unread.alerts} onMarkRead={props.onMarkAlertRead} />
      <InboxSection
        forYou
        me={me}
        nudgeActions={props.nudges}
        nudges={unread.nudges}
        rows={rows}
        selected={selected}
        title={TEXT.forYou}
      />
      <InboxSection
        forYou={false}
        me={me}
        nudgeActions={props.nudges}
        nudges={NO_NUDGES}
        rows={rows}
        selected={selected}
        title={TEXT.activity}
      />
    </>
  );
}
