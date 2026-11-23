import type { ReactNode } from "react";
import { ThreadSummary } from "../../design-system/index.tsx";
import type { ThreadSummaryOf } from "./message-marks.ts";
import { replies } from "./message-marks.ts";
import { useDrawnAuthors } from "./use-is-agent.ts";
import { useTimeAgo } from "./use-time-ago.ts";

interface ReplySummaryProps {
  readonly href: string;
  readonly summary: ThreadSummaryOf;
}

export function ReplySummary({ href, summary }: ReplySummaryProps): ReactNode {
  const repliers = useDrawnAuthors(summary.repliers);
  const last = `Last reply ${useTimeAgo(summary.latestReplyAt)}`;
  const count = replies(summary.replyCount);
  return <ThreadSummary count={count} href={href} label={`${count}, ${last}`} last={last} repliers={repliers} />;
}
