import { FeedHeading, FeedList } from "../../design-system/index.tsx";
import type { InboxRow, Nudges } from "../../unread/index.ts";
import { InboxRowView } from "./inbox-row-view.tsx";
import type { Nudge } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { UnreadNudgeRow } from "./unread-nudge-row.tsx";

const NONE = 0;

interface InboxSectionProps {
  readonly title: string;
  readonly rows: readonly InboxRow[];
  readonly forYou: boolean;
  readonly me: string;
  readonly nudges: readonly Nudge[];
  readonly nudgeActions: Pick<Nudges, "close" | "markRead">;
}

export function InboxSection(props: InboxSectionProps): ReactNode {
  const { me, nudgeActions, nudges } = props;
  const rows = props.rows.filter((row) => row.forYou === props.forYou);
  const count = rows.length + nudges.length;
  return (
    count > NONE && (
      <>
        <FeedHeading count={count} title={props.title} />
        <FeedList label={props.title}>
          {nudges.map((nudge) => (
            <UnreadNudgeRow key={`nudge ${String(nudge.id)}`} nudge={nudge} nudges={nudgeActions} />
          ))}
          {rows.map((row) => (
            <InboxRowView key={row.key} me={me} row={row} unread />
          ))}
        </FeedList>
      </>
    )
  );
}
