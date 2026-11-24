import { FeedHeading, FeedList } from "../../design-system/index.tsx";
import type { InboxRow } from "../../unread/index.ts";
import { InboxRowView } from "./inbox-row-view.tsx";
import type { ReactNode } from "react";

const NONE = 0;

interface InboxSectionProps {
  readonly title: string;
  readonly rows: readonly InboxRow[];
  readonly forYou: boolean;
  readonly me: string;
  readonly besides: number;
  readonly children?: ReactNode;
}

export function InboxSection(props: InboxSectionProps): ReactNode {
  const { me } = props;
  const rows = props.rows.filter((row) => row.forYou === props.forYou);
  const count = rows.length + props.besides;
  return (
    count > NONE && (
      <>
        <FeedHeading count={count} title={props.title} />
        <FeedList label={props.title}>
          {props.children}
          {rows.map((row) => (
            <InboxRowView key={row.key} me={me} row={row} unread />
          ))}
        </FeedList>
      </>
    )
  );
}
