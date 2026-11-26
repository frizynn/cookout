import { useMemo, useSyncExternalStore } from "react";
import type { MessageId } from "../../sdk/index.ts";
import type { Quoted } from "../../board/index.ts";
import { quoteOf } from "../../board/index.ts";
import { useBoardStore } from "./use-board.ts";

export function useQuote(id: MessageId): Quoted {
  const store = useBoardStore();
  const select = useMemo(() => quoteOf(id), [id]);
  return useSyncExternalStore(store.subscribeShowingQuote(id), () => select(store.snapshot()));
}
