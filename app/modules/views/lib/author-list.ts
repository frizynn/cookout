import type { Identities } from "../../composer/index.ts";
import type { Identity } from "../../sdk/index.ts";
import { createContext } from "react";

const NOBODY: readonly Identity[] = [];

const nobody: Identities = {
  snapshot: () => NOBODY,
  subscribe: (listener) => {
    const listeners = new Set([listener]);
    return () => {
      listeners.clear();
    };
  },
};

const AuthorList = createContext<Identities>(nobody);

export { AuthorList };
