import type { Identities } from "../../composer/index.ts";
import { createCommands } from "../../board/index.ts";
import { createComposer } from "../../composer/index.ts";
import { createContext } from "react";
import { createCookoutClient } from "../../sdk/index.ts";

const client = createCookoutClient({ env: {}, url: globalThis.location.origin });
const pageIdentities = createComposer({ client, commands: createCommands({ client }) });

const AuthorList = createContext<Identities>(pageIdentities.identities);

export { AuthorList };
