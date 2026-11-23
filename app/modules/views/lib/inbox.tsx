import { Feed, Pane, PaneHeader } from "../../design-system/index.tsx";
import { InboxBody } from "./inbox-body.tsx";
import { InboxEarlier } from "./inbox-earlier.tsx";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useSyncExternalStore } from "react";

const TEXT = {
  description: "Mentions, threads you follow, and channels you subscribe to",
  title: "Inbox",
} as const;

interface InboxProps {
  readonly unread: Unread;
  readonly me: string;
}

export function InboxView(props: InboxProps): ReactNode {
  const unread = useSyncExternalStore(props.unread.subscribe, props.unread.snapshot);
  return (
    <Pane>
      <PaneHeader description={TEXT.description} sans title={TEXT.title} />
      <Feed label={TEXT.title}>
        <InboxBody me={props.me} unread={unread} />
        {unread.status === "loaded" && <InboxEarlier earlier={props.unread.earlier} me={props.me} />}
      </Feed>
    </Pane>
  );
}
