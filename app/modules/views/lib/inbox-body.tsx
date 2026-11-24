import { Alert, FeedNote, Skeleton } from "../../design-system/index.tsx";
import type { InboxItem, OfflineAlertId } from "../../sdk/index.ts";
import type { Nudges, UnreadState } from "../../unread/index.ts";
import { InboxAlerts } from "./inbox-alerts.tsx";
import { InboxSection } from "./inbox-section.tsx";
import type { ReactNode } from "react";
import { rowsOf } from "../../unread/index.ts";
import { useMemo } from "react";

const NONE = 0;

const TEXT = { activity: "Activity", empty: "You're all caught up.", forYou: "For you" } as const;
const NO_NUDGES = [] as const;

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
  readonly nudges: Pick<Nudges, "close" | "markRead">;
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
      {unread.inbox.length + unread.alerts.length + unread.nudges.length === NONE && (
        <FeedNote place="empty">{TEXT.empty}</FeedNote>
      )}
      <InboxAlerts alerts={unread.alerts} onMarkRead={props.onMarkAlertRead} />
      <InboxSection forYou me={me} nudgeActions={props.nudges} nudges={unread.nudges} rows={rows} title={TEXT.forYou} />
      <InboxSection
        forYou={false}
        me={me}
        nudgeActions={props.nudges}
        nudges={NO_NUDGES}
        rows={rows}
        title={TEXT.activity}
      />
    </>
  );
}
