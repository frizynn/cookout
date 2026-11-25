import { Alert, ItemList, Muted, Skeleton } from "../../design-system/content.tsx";
import type { Board, ScheduleListState } from "../../board/index.ts";
import type { ChannelName, Identity } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { ScheduleListRow } from "./schedule-list-row.tsx";
import { useSyncExternalStore } from "react";

const NONE = 0;

const TEXT = {
  empty: (channel: ChannelName) => `Nothing is scheduled in #${channel}.`,
  failed: "Couldn't load the scheduled messages.",
  label: (channel: ChannelName) => `#${channel} scheduled messages`,
} as const;

interface ScheduleListBodyProps {
  readonly board: Board;
  readonly channel: ChannelName;
  readonly me: Identity;
  readonly state: ScheduleListState;
}

export function ScheduleListBody(props: ScheduleListBodyProps): ReactNode {
  const { board, channel } = props;
  const schedules = board.schedules(channel);
  const listed = useSyncExternalStore(schedules.subscribe, schedules.snapshot);
  if (listed.status === "loading") {
    return <Skeleton width="long" />;
  }
  if (listed.status !== "loaded") {
    return <Alert>{TEXT.failed}</Alert>;
  }
  if (listed.schedules.length === NONE) {
    return <Muted>{TEXT.empty(channel)}</Muted>;
  }
  return (
    <ItemList label={TEXT.label(channel)}>
      {listed.schedules.map((schedule) => (
        <ScheduleListRow board={board} key={schedule.id} me={props.me} schedule={schedule} state={props.state} />
      ))}
    </ItemList>
  );
}
