import { useMemo, useSyncExternalStore } from "react";
import type { Board } from "../../board/index.ts";
import type { Identities } from "../../composer/index.ts";
import { InboxConversation } from "./inbox-conversation.tsx";
import { InboxList } from "./inbox-list.tsx";
import type { InboxSelection } from "../../paths/index.ts";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useInboxRows } from "./use-inbox-rows.ts";

interface InboxProps {
  readonly board: Board;
  readonly unread: Unread;
  readonly me: string;
  readonly selected: InboxSelection | null;
  readonly identities: Identities;
}

export function InboxView(props: InboxProps): ReactNode {
  const { board, me, selected, unread } = props;
  const state = useSyncExternalStore(unread.subscribe, unread.snapshot);
  const rows = useInboxRows({ me, selected, state, unread });
  const { deactivationOffers, nudges } = unread;
  const notices = useMemo(
    () => ({ deactivationOffers, identities: props.identities, nudges }),
    [deactivationOffers, nudges, props.identities],
  );
  return (
    <>
      <InboxList
        board={board}
        me={me}
        notices={notices}
        rows={rows}
        selected={selected}
        state={state}
        unread={unread}
      />
      {state.status !== "loading" && <InboxConversation board={board} me={me} selected={selected} unread={unread} />}
    </>
  );
}
