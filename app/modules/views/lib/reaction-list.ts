import type { BoardStore } from "../../board/index.ts";
import { createBoardStore } from "../../board/index.ts";
import { createContext } from "react";
import { createCookoutClient } from "../../sdk/index.ts";

const client = createCookoutClient({ env: {}, url: globalThis.location.origin });

const ReactionList = createContext<BoardStore>(createBoardStore({ client, live: null }));

export { ReactionList };
