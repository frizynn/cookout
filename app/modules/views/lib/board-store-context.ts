import { createContext, useContext } from "react";
import type { BoardStore } from "../../board/index.ts";

const BoardStoreContext = createContext<BoardStore | null>(null);

function useBoardStore(): BoardStore {
  const store = useContext(BoardStoreContext);
  if (store === null) {
    throw new Error("A view that reads the board store is drawn inside Authors, which provides it.");
  }
  return store;
}

export { BoardStoreContext, useBoardStore };
