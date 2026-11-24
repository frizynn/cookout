import { Alert, FeedHeading, Skeleton } from "../../design-system/index.tsx";
import { EarlierAlerts } from "./earlier-alerts.tsx";
import { EarlierItems } from "./earlier-items.tsx";
import { EarlierMore } from "./earlier-more.tsx";
import { EarlierNudges } from "./earlier-nudges.tsx";
import type { InboxRows } from "./use-inbox-rows.ts";
import type { InboxSelection } from "../../paths/index.ts";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { heldKey } from "./use-inbox-rows.ts";
import { useSyncExternalStore } from "react";

const TITLE = "Earlier";

interface InboxEarlierProps {
  readonly earlier: Unread["earlier"];
  readonly alerts: Unread["alerts"];
  readonly nudges: Unread["nudges"];
  readonly me: string;
  readonly rows: InboxRows;
  readonly selected: InboxSelection | null;
}

export function InboxEarlier(props: InboxEarlierProps): ReactNode {
  const { earlier } = props;
  const state = useSyncExternalStore(earlier.subscribe, earlier.snapshot);
  if (state.status === "loading") {
    return <Skeleton width="long" />;
  }
  if (state.status === "failed") {
    return <Alert>{`Couldn't load what you've read (${state.code}): ${state.message}`}</Alert>;
  }
  return (
    <>
      <FeedHeading count={null} title={TITLE} />
      <EarlierNudges nudges={props.nudges} />
      <EarlierAlerts alerts={props.alerts} />
      <EarlierItems
        hasMore={state.hasMore}
        hidden={heldKey(props.rows)}
        items={state.items}
        label={TITLE}
        me={props.me}
        selected={props.selected}
      />
      <EarlierMore earlier={earlier} state={state} />
    </>
  );
}
