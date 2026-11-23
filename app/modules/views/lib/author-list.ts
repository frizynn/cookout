import type { Identities } from "../../composer/index.ts";
import { createComposer } from "../../composer/index.ts";
import { createContext } from "react";
import { createCookoutClient } from "../../sdk/index.ts";

const pageIdentities = createComposer({ client: createCookoutClient({ env: {}, url: globalThis.location.origin }) });

const AuthorList = createContext<Identities>(pageIdentities.identities);

export { AuthorList };
