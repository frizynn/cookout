import { FeedList, FeedNote } from "../../design-system/index.tsx";
import type { InboxItem } from "../../sdk/index.ts";
import { InboxRowView } from "./inbox-row-view.tsx";
import type { ReactNode } from "react";
import { rowsOf } from "../../unread/index.ts";
import { useMemo } from "react";

const NONE = 0;
const EMPTY = "Nothing read yet.";

interface EarlierItemsProps {
  readonly items: readonly InboxItem[];
  readonly hasMore: boolean;
  readonly label: string;
  readonly me: string;
}

export function EarlierItems(props: EarlierItemsProps): ReactNode {
  const { items, me } = props;
  const rows = useMemo(() => rowsOf({ items, me }), [items, me]);
  if (rows.length === NONE) {
    return !props.hasMore && <FeedNote place="empty">{EMPTY}</FeedNote>;
  }
  return (
    <FeedList label={props.label}>
      {rows.map((row) => (
        <InboxRowView key={row.key} me={me} row={row} unread={false} />
      ))}
    </FeedList>
  );
}
