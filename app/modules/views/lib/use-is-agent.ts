import { useContext, useSyncExternalStore } from "react";
import type { Author } from "../../sdk/index.ts";
import { AuthorList } from "./author-list.ts";

function useIsAgent(author: Author): boolean {
  const identities = useContext(AuthorList);
  const listed = useSyncExternalStore(identities.subscribe, identities.snapshot);
  for (const identity of listed) {
    if (identity.name === author.name) {
      return identity.kind === "agent";
    }
  }
  return "owner" in author;
}

export { useIsAgent };
