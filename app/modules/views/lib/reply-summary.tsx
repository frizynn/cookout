import type { NewsText, ThreadSummaryOf } from "./message-marks.ts";
import { newsText, replies } from "./message-marks.ts";
import type { ReactNode } from "react";
import type { ThreadNews } from "../../unread/index.ts";
import { ThreadSummary } from "../../design-system/index.tsx";
import { useDrawnAuthors } from "./use-author.ts";
import { useTimeAgo } from "./use-time-ago.ts";

interface ReplySummaryProps {
  readonly href: string;
  readonly summary: ThreadSummaryOf;
  readonly news: ThreadNews | null;
}

function labelOf(count: string, fresh: NewsText | null, last: string): string {
  if (fresh === null) {
    return `${count}, ${last}`;
  }
  return `${count}, ${fresh.text}, ${last}`;
}

export function ReplySummary({ href, news, summary }: ReplySummaryProps): ReactNode {
  const repliers = useDrawnAuthors(summary.repliers);
  const last = `Last reply ${useTimeAgo(summary.latestReplyAt)}`;
  const count = replies(summary.replyCount);
  const fresh = newsText(news);
  return (
    <ThreadSummary
      count={count}
      href={href}
      label={labelOf(count, fresh, last)}
      last={last}
      news={fresh}
      repliers={repliers}
    />
  );
}
