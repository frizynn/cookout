import type { ReactionStore } from "../../reaction-store/index.ts";
import { createContext } from "react";
import { createCookoutClient } from "../../sdk/index.ts";
import { createReactionStore } from "../../reaction-store/index.ts";

const client = createCookoutClient({ env: {}, url: globalThis.location.origin });

const ReactionList = createContext<ReactionStore>(createReactionStore({ client, live: null }));

export { ReactionList };
