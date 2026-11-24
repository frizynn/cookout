import type { Board } from "../../board/index.ts";
import { InboxConversation } from "./inbox-conversation.tsx";
import { InboxList } from "./inbox-list.tsx";
import type { InboxSelection } from "../../paths/index.ts";
import type { ReactNode } from "react";
import type { Unread } from "../../unread/index.ts";
import { useInboxRows } from "./use-inbox-rows.ts";
import { useSyncExternalStore } from "react";

interface InboxProps {
  readonly board: Board;
  readonly unread: Unread;
  readonly me: string;
  readonly selected: InboxSelection | null;
}

export function InboxView(props: InboxProps): ReactNode {
  const { board, me, selected, unread } = props;
  const state = useSyncExternalStore(unread.subscribe, unread.snapshot);
  const rows = useInboxRows({ me, selected, state, unread });
  return (
    <>
      <InboxList board={board} me={me} rows={rows} selected={selected} state={state} unread={unread} />
      {state.status !== "loading" && <InboxConversation board={board} me={me} selected={selected} unread={unread} />}
    </>
  );
}
