import { Feed, Pane, PaneHeader } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import { DeletedNotice } from "./deleted-notice.tsx";
import { InboxBody } from "./inbox-body.tsx";
import { InboxEarlier } from "./inbox-earlier.tsx";
import { MarkAllFailed } from "./mark-all-failed.tsx";
import { MarkAllRead } from "./mark-all-read.tsx";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useSyncExternalStore } from "react";

const TEXT = {
  description: "Mentions, threads you follow, and channels you subscribe to",
  title: "Inbox",
} as const;

interface InboxProps {
  readonly board: Board;
  readonly unread: Unread;
  readonly me: string;
}

export function InboxView(props: InboxProps): ReactNode {
  const unread = useSyncExternalStore(props.unread.subscribe, props.unread.snapshot);
  const handleMarkAlertRead = props.unread.alerts.markRead;
  return (
    <Pane>
      <PaneHeader description={TEXT.description} sans title={TEXT.title}>
        {unread.status === "loaded" && <MarkAllRead state={unread} unread={props.unread} />}
      </PaneHeader>
      <DeletedNotice board={props.board} />
      <Feed label={TEXT.title}>
        {unread.status === "loaded" && <MarkAllFailed markAll={unread.markAll} />}
        <InboxBody me={props.me} onMarkAlertRead={handleMarkAlertRead} unread={unread} />
        {unread.status === "loaded" && (
          <InboxEarlier alerts={props.unread.alerts} earlier={props.unread.earlier} me={props.me} />
        )}
      </Feed>
    </Pane>
  );
}
