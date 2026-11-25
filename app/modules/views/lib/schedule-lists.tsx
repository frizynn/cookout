import type { Board } from "../../board/index.ts";
import type { Identity } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { ScheduleListDialog } from "./schedule-list-dialog.tsx";
import { ScheduleMarking } from "./schedule-marking.ts";
import { useMemo } from "react";

interface ScheduleListsProps {
  readonly board: Board;
  readonly me: Identity;
  readonly children: ReactNode;
}

export function ScheduleLists(props: ScheduleListsProps): ReactNode {
  const { board } = props;
  const marking = useMemo(() => ({ marks: board.scheduleMarks, open: board.scheduleList.open }), [board]);
  return (
    <ScheduleMarking value={marking}>
      {props.children}
      <ScheduleListDialog board={board} me={props.me} />
    </ScheduleMarking>
  );
}
