import { Alert, CardBody, LinkList, Muted, Skeleton } from "../../design-system/index.tsx";
import type { UnreadCounts, UnreadState } from "../../unread/index.ts";
import type { ChannelName } from "../../sdk/index.ts";
import { InboxItemRow } from "./inbox-item-row.tsx";
import type { ReactNode } from "react";
import { UnreadChannelRow } from "./unread-channel-row.tsx";

const NONE = 0;

const TEXT = {
  byChannel: "Unread by channel",
  empty: "Nothing unread.",
  inbox: "Inbox",
  messages: "Unread messages",
} as const;

type ChannelCounts = readonly [ChannelName, UnreadCounts];

function byName([first]: ChannelCounts, [second]: ChannelCounts): number {
  return first.localeCompare(second);
}

interface InboxBodyProps {
  readonly unread: UnreadState;
}

export function InboxBody(props: InboxBodyProps): ReactNode {
  const { unread } = props;
  if (unread.status === "loading") {
    return (
      <CardBody>
        <Skeleton width="short" />
        <Skeleton width="long" />
      </CardBody>
    );
  }
  if (unread.status === "failed") {
    return <Alert>{`Couldn't load the inbox (${unread.code}): ${unread.message}`}</Alert>;
  }
  if (unread.items.length === NONE) {
    return (
      <CardBody>
        <Muted>{TEXT.empty}</Muted>
      </CardBody>
    );
  }
  const channels: readonly ChannelCounts[] = [...unread.channels].toSorted(byName);
  return (
    <>
      <CardBody>
        <Muted>{TEXT.byChannel}</Muted>
      </CardBody>
      <LinkList label={TEXT.byChannel}>
        {channels.map(([channel, counts]) => (
          <UnreadChannelRow channel={channel} counts={counts} key={channel} />
        ))}
      </LinkList>
      <CardBody>
        <Muted>{TEXT.messages}</Muted>
      </CardBody>
      <LinkList label={TEXT.inbox}>
        {unread.items.map((item) => (
          <InboxItemRow item={item} key={item.message.id} />
        ))}
      </LinkList>
    </>
  );
}
