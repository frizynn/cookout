import { Alert, FeedList, FeedNote, Skeleton } from "../../design-system/index.tsx";
import type { OpenThreads, ThreadClosing } from "../../board/index.ts";
import { OpenThreadMore } from "./open-thread-more.tsx";
import { OpenThreadRow } from "./open-thread-row.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const NONE = 0;

const TEXT = { empty: "No open threads.", list: "Open threads" } as const;

interface OpenThreadListProps {
  readonly closing: ThreadClosing;
  readonly openThreads: OpenThreads;
}

export function OpenThreadList(props: OpenThreadListProps): ReactNode {
  const { openThreads } = props;
  const state = useSyncExternalStore(openThreads.subscribe, openThreads.snapshot);
  if (state.status === "loading") {
    return <Skeleton width="long" />;
  }
  if (state.status === "failed") {
    return <Alert>{`Couldn't load the open threads (${state.code}): ${state.message}`}</Alert>;
  }
  return (
    <>
      {state.threads.length === NONE && <FeedNote place="empty">{TEXT.empty}</FeedNote>}
      <FeedList label={TEXT.list}>
        {state.threads.map((thread) => (
          <OpenThreadRow closing={props.closing} key={thread.message.id} thread={thread} />
        ))}
      </FeedList>
      <OpenThreadMore openThreads={openThreads} state={state} />
    </>
  );
}
