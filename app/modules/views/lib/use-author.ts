import type { Author, Identity } from "../../sdk/index.ts";
import { useContext, useSyncExternalStore } from "react";
import { AuthorList } from "./author-list.ts";

interface Shown {
  readonly agent: boolean;
  readonly displayName: string | null;
}

function useListed(name: string): Identity | null {
  const identities = useContext(AuthorList);
  const listed = useSyncExternalStore(identities.subscribe, identities.snapshot);
  return listed.find((identity) => identity.name === name) ?? null;
}

function useAuthor(author: Author): Shown {
  const identity = useListed(author.name);
  if (identity === null) {
    return { agent: "owner" in author, displayName: null };
  }
  return { agent: identity.kind === "agent", displayName: identity.displayName ?? null };
}

export { useAuthor, useListed };
