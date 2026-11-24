import { Feed, ListPane } from "../../design-system/index.tsx";
import type { Unread, UnreadState } from "../../unread/index.ts";
import type { Board } from "../../board/index.ts";
import { InboxBody } from "./inbox-body.tsx";
import { InboxEarlier } from "./inbox-earlier.tsx";
import { InboxHeader } from "./inbox-header.tsx";
import type { InboxRows } from "./use-inbox-rows.ts";
import type { InboxSelection } from "../../paths/index.ts";
import { MarkAllFailed } from "./mark-all-failed.tsx";
import type { ReactNode } from "react";

const TITLE = "Inbox";

interface InboxListProps {
  readonly board: Board;
  readonly unread: Unread;
  readonly state: UnreadState;
  readonly rows: InboxRows;
  readonly me: string;
  readonly selected: InboxSelection | null;
}

export function InboxList(props: InboxListProps): ReactNode {
  const { me, rows, selected, state: unread } = props;
  const handleMarkAlertRead = props.unread.alerts.markRead;
  return (
    <ListPane hiddenWhenNarrow={selected !== null}>
      <InboxHeader board={props.board} state={unread} title={TITLE} unread={props.unread} />
      <Feed label={TITLE}>
        {unread.status === "loaded" && <MarkAllFailed markAll={unread.markAll} />}
        <InboxBody
          me={me}
          nudges={props.unread.nudges}
          onMarkAlertRead={handleMarkAlertRead}
          rows={rows}
          selected={selected}
          unread={unread}
        />
        {unread.status === "loaded" && (
          <InboxEarlier
            alerts={props.unread.alerts}
            earlier={props.unread.earlier}
            rows={rows}
            me={me}
            nudges={props.unread.nudges}
            selected={selected}
          />
        )}
      </Feed>
    </ListPane>
  );
}
