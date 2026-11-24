import { Alert, FeedHeading, Skeleton } from "../../design-system/index.tsx";
import { EarlierAlerts } from "./earlier-alerts.tsx";
import { EarlierItems } from "./earlier-items.tsx";
import { EarlierMore } from "./earlier-more.tsx";
import { EarlierNudges } from "./earlier-nudges.tsx";
import { EarlierOffers } from "./earlier-offers.tsx";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useSyncExternalStore } from "react";

const TITLE = "Earlier";

interface InboxEarlierProps {
  readonly unread: Pick<Unread, "alerts" | "deactivationOffers" | "earlier" | "nudges">;
  readonly me: string;
}

export function InboxEarlier(props: InboxEarlierProps): ReactNode {
  const { unread } = props;
  const { earlier } = unread;
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
      <EarlierOffers offers={unread.deactivationOffers} />
      <EarlierNudges nudges={unread.nudges} />
      <EarlierAlerts alerts={unread.alerts} />
      <EarlierItems hasMore={state.hasMore} items={state.items} label={TITLE} me={props.me} />
      <EarlierMore earlier={earlier} state={state} />
    </>
  );
}
