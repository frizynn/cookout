import { Alert, FeedHeading, Skeleton } from "../../design-system/index.tsx";
import { EarlierAlerts } from "./earlier-alerts.tsx";
import { EarlierItems } from "./earlier-items.tsx";
import { EarlierMore } from "./earlier-more.tsx";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useSyncExternalStore } from "react";

const TITLE = "Earlier";

interface InboxEarlierProps {
  readonly earlier: Unread["earlier"];
  readonly alerts: Unread["alerts"];
  readonly me: string;
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
      <EarlierAlerts alerts={props.alerts} />
      <EarlierItems hasMore={state.hasMore} items={state.items} label={TITLE} me={props.me} />
      <EarlierMore earlier={earlier} state={state} />
    </>
  );
}
