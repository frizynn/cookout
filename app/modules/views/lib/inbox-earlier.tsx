import { Alert, FeedHeading, Skeleton } from "../../design-system/index.tsx";
import type { Earlier } from "../../unread/index.ts";
import { EarlierItems } from "./earlier-items.tsx";
import { EarlierMore } from "./earlier-more.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TITLE = "Earlier";

interface InboxEarlierProps {
  readonly earlier: Earlier;
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
      <EarlierItems hasMore={state.hasMore} items={state.items} label={TITLE} me={props.me} />
      <EarlierMore earlier={earlier} state={state} />
    </>
  );
}
