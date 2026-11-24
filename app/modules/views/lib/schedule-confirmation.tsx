import { Button, Notice } from "../../design-system/index.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import type { ScheduledMessage } from "../../scheduled-messages/index.ts";
import type { Scheduling } from "../../board/index.ts";
import { runTimeIn } from "../../format/index.ts";
import { useSyncExternalStore } from "react";

const TEXT = { dismiss: "Dismiss", scheduled: "Scheduled." } as const;

interface ScheduleConfirmationProps {
  readonly channel: ChannelName;
  readonly scheduling: Scheduling;
}

function confirmationOf(scheduled: ScheduledMessage): string {
  const [next = null] = scheduled.nextRuns;
  if (next === null) {
    return TEXT.scheduled;
  }
  return `${TEXT.scheduled} Its next run is ${runTimeIn({ iso: next, timeZone: scheduled.timeZone })} (${scheduled.timeZone}).`;
}

export function ScheduleConfirmation(props: ScheduleConfirmationProps): ReactNode {
  const { scheduling } = props;
  const { scheduled } = useSyncExternalStore(scheduling.subscribe, scheduling.snapshot);
  const handleDismiss = scheduling.dismiss;
  if (scheduled === null || scheduled.channel !== props.channel) {
    return null;
  }
  return (
    <Notice>
      <span>{confirmationOf(scheduled)}</span>
      <Button onClick={handleDismiss}>{TEXT.dismiss}</Button>
    </Notice>
  );
}
