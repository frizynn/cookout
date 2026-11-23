import type { PresenceStore } from "../../presence-store/index.ts";
import { createContext } from "react";
import { createCookoutClient } from "../../sdk/index.ts";
import { createPresenceStore } from "../../presence-store/index.ts";

const client = createCookoutClient({ env: {}, url: globalThis.location.origin });

const PresenceList = createContext<PresenceStore>(createPresenceStore({ client, live: null }));

export { PresenceList };
