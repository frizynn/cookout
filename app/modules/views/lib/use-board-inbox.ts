import { useContext, useSyncExternalStore } from "react";
import type { BoardState } from "../../board/index.ts";
import { ReactionList } from "./reaction-list.ts";

export function useBoardInbox<Out>(select: (state: BoardState) => Out): Out {
  const store = useContext(ReactionList);
  return useSyncExternalStore(store.subscribeShowing("inbox"), () => select(store.snapshot()));
}
