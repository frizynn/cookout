import { FeedList, FeedNote } from "../../design-system/index.tsx";
import type { InboxItem } from "../../sdk/index.ts";
import { InboxItemRow } from "./inbox-item-row.tsx";
import type { ReactNode } from "react";

const NONE = 0;
const EMPTY = "Nothing read yet.";

interface EarlierItemsProps {
  readonly items: readonly InboxItem[];
  readonly hasMore: boolean;
  readonly label: string;
  readonly me: string;
}

export function EarlierItems(props: EarlierItemsProps): ReactNode {
  if (props.items.length === NONE) {
    return !props.hasMore && <FeedNote place="empty">{EMPTY}</FeedNote>;
  }
  return (
    <FeedList label={props.label}>
      {props.items.map((item) => (
        <InboxItemRow item={item} key={item.message.id} me={props.me} unread={false} />
      ))}
    </FeedList>
  );
}
