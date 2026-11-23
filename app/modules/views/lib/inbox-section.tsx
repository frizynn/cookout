import { FeedHeading, FeedList } from "../../design-system/index.tsx";
import type { InboxItem } from "../../sdk/index.ts";
import { InboxItemRow } from "./inbox-item-row.tsx";
import type { ReactNode } from "react";
import { isForYou } from "../../unread/index.ts";

const NONE = 0;

interface InboxSectionProps {
  readonly title: string;
  readonly items: readonly InboxItem[];
  readonly forYou: boolean;
  readonly me: string;
}

export function InboxSection(props: InboxSectionProps): ReactNode {
  const { me } = props;
  const items = props.items.toReversed().filter((item) => isForYou({ item, me }) === props.forYou);
  return (
    items.length > NONE && (
      <>
        <FeedHeading count={items.length} title={props.title} />
        <FeedList label={props.title}>
          {items.map((item) => (
            <InboxItemRow item={item} key={item.message.id} me={me} unread />
          ))}
        </FeedList>
      </>
    )
  );
}
