import { FormDialog, InputField } from "../../design-system/controls.tsx";
import { useCallback, useSyncExternalStore } from "react";
import { Alert } from "../../design-system/content.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { ScheduleRuns } from "./schedule-runs.tsx";
import { ScheduleTiming } from "./schedule-timing.tsx";
import type { Scheduling } from "../../board/index.ts";
import { refusalWords } from "./schedule-words.ts";
import { useScheduleCancel } from "./use-schedule-cancel.ts";

const TEXT = {
  busy: "Scheduling…",
  button: "Schedule",
  text: "Text",
  title: "Schedule a message",
} as const;

const EDITING = { button: "Save", failed: "Couldn't save it.", title: "Edit a scheduled message" } as const;

const MAKING = { button: TEXT.button, failed: "Couldn't schedule it.", title: TEXT.title } as const;

function wordsOf(editing: boolean): typeof EDITING | typeof MAKING {
  if (editing) {
    return EDITING;
  }
  return MAKING;
}

interface ScheduleDialogProps {
  readonly cancelled: string | null;
  readonly channel: ChannelName;
  readonly scheduling: Scheduling;
  readonly onSaved: () => void;
  readonly editing?: boolean;
}

export function ScheduleDialog(props: ScheduleDialogProps): ReactNode {
  const { onSaved, scheduling } = props;
  const state = useSyncExternalStore(scheduling.subscribe, scheduling.snapshot);
  const editing = props.editing === true;
  const words = wordsOf(editing);
  const handleCancel = useScheduleCancel({ cancelled: props.cancelled, scheduling });
  const handleEditText = scheduling.editText;
  const handleSubmit = useCallback(() => {
    scheduling.save(onSaved);
  }, [onSaved, scheduling]);
  return (
    <FormDialog
      busy={state.save.status === "saving"}
      busyButton={TEXT.busy}
      button={words.button}
      description={`Posts as you in #${props.channel}, as a new message each time.`}
      disabled={state.preview.status !== "shown"}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
      open={state.open && state.channel === props.channel && (state.editing !== null) === editing}
      title={words.title}
    >
      <InputField
        error={null}
        help={null}
        kind="text"
        label={TEXT.text}
        onEdit={handleEditText}
        required
        value={state.text}
      />
      <ScheduleTiming scheduling={scheduling} state={state} />
      <ScheduleRuns state={state} />
      {state.save.status === "failed" && <Alert>{`${words.failed} ${refusalWords(state.save)}`}</Alert>}
    </FormDialog>
  );
}
