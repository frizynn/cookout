import type { ScheduleList, Scheduling } from "../../board/index.ts";
import { useCallback, useSyncExternalStore } from "react";
import type { Identity } from "../../sdk/index.ts";
import { ListDialog } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";
import { ScheduleDeleteConfirm } from "./schedule-delete-confirm.tsx";
import { ScheduleDialog } from "./schedule-dialog.tsx";
import { ScheduleListBody } from "./schedule-list-body.tsx";

const TEXT = {
  close: "Close",
  description: (channel: string) => `What posts into #${channel} on a schedule, soonest made first.`,
  title: "Scheduled messages",
} as const;

interface ScheduleListDialogProps {
  readonly me: Identity;
  readonly scheduleList: ScheduleList;
  readonly scheduling: Scheduling;
}

export function ScheduleListDialog(props: ScheduleListDialogProps): ReactNode {
  const { scheduleList, scheduling } = props;
  const state = useSyncExternalStore(scheduleList.subscribe, scheduleList.snapshot);
  const handleClose = scheduleList.close;
  const { channel } = state;
  const { editing } = useSyncExternalStore(scheduling.subscribe, scheduling.snapshot);
  const handleSaved = useCallback(() => {
    if (channel !== null) {
      scheduleList.open(channel, editing);
    }
  }, [channel, editing, scheduleList]);
  return (
    <ListDialog
      close={TEXT.close}
      description={TEXT.description(channel ?? "")}
      onClose={handleClose}
      open={channel !== null}
      title={TEXT.title}
    >
      {channel !== null && (
        <ScheduleListBody
          channel={channel}
          me={props.me}
          scheduleList={scheduleList}
          scheduling={scheduling}
          state={state}
        />
      )}
      {channel !== null && <ScheduleDialog channel={channel} editing onSaved={handleSaved} scheduling={scheduling} />}
      <ScheduleDeleteConfirm scheduleList={scheduleList} state={state} />
    </ListDialog>
  );
}
