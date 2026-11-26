import { ChoiceGroup, InputField } from "../../design-system/controls.tsx";
import { OnceFields } from "./schedule-once-fields.tsx";
import type { ReactNode } from "react";
import type { ScheduleFieldsProps } from "./schedule-once-fields.tsx";
import type { ScheduleKind } from "../../board/index.ts";
import { useCallback } from "react";

const TEXT = {
  cron: "Cron expression",
  cronHelp: "Minute, hour, day of month, month and weekday, such as 0 9 * * 1-5 for 9am on weekdays.",
  kind: "Repeats",
  timeZone: "Time zone",
  timeZoneHelp: "Yours by default. An IANA name, such as Europe/London.",
} as const;

const KINDS = [
  { label: "Once", value: "once" },
  { label: "Recurring", value: "recurring" },
] as const;

type ScheduleTimingProps = ScheduleFieldsProps;

function kindOf(value: string): ScheduleKind {
  if (value === "recurring") {
    return "recurring";
  }
  return "once";
}

export function ScheduleTiming(props: ScheduleTimingProps): ReactNode {
  const { scheduling, state } = props;
  const handleEditCron = scheduling.editCron;
  const handleEditTimeZone = scheduling.editTimeZone;
  const handleChoose = useCallback(
    (value: string) => {
      scheduling.chooseKind(kindOf(value));
    },
    [scheduling],
  );
  return (
    <>
      <ChoiceGroup choices={KINDS} label={TEXT.kind} onChoose={handleChoose} value={state.kind} />
      {state.kind === "recurring" && (
        <InputField
          error={null}
          help={TEXT.cronHelp}
          kind="text"
          label={TEXT.cron}
          onEdit={handleEditCron}
          required
          value={state.cron}
        />
      )}
      {state.kind === "once" && <OnceFields scheduling={scheduling} state={state} />}
      <InputField
        error={null}
        help={TEXT.timeZoneHelp}
        kind="text"
        label={TEXT.timeZone}
        onEdit={handleEditTimeZone}
        required
        value={state.timeZone}
      />
    </>
  );
}
