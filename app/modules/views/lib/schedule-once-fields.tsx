import type { Scheduling, SchedulingSnapshot } from "../../board/index.ts";
import { InputField } from "../../design-system/controls.tsx";
import type { ReactNode } from "react";

const TEXT = { date: "Date", time: "Time" } as const;

interface ScheduleFieldsProps {
  readonly scheduling: Scheduling;
  readonly state: SchedulingSnapshot;
}

export function OnceFields(props: ScheduleFieldsProps): ReactNode {
  const { scheduling, state } = props;
  const handleEditDate = scheduling.editDate;
  const handleEditTime = scheduling.editTime;
  return (
    <div className="grid grid-cols-2 gap-3">
      <InputField
        error={null}
        help={null}
        kind="date"
        label={TEXT.date}
        onEdit={handleEditDate}
        required
        value={state.date}
      />
      <InputField
        error={null}
        help={null}
        kind="time"
        label={TEXT.time}
        onEdit={handleEditTime}
        required
        value={state.time}
      />
    </div>
  );
}

export type { ScheduleFieldsProps };
