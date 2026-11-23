import { useContext, useSyncExternalStore } from "react";
import type { Author } from "../../sdk/index.ts";
import { AuthorList } from "./author-list.ts";

type Listed = ReturnType<React.ContextType<typeof AuthorList>["snapshot"]>;

interface Drawn {
  readonly name: string;
  readonly agent: boolean;
}

function isAgentIn(listed: Listed, author: Author): boolean {
  for (const identity of listed) {
    if (identity.name === author.name) {
      return identity.kind === "agent";
    }
  }
  return "owner" in author;
}

function useListed(): Listed {
  const identities = useContext(AuthorList);
  return useSyncExternalStore(identities.subscribe, identities.snapshot);
}

function useIsAgent(author: Author): boolean {
  return isAgentIn(useListed(), author);
}

function useDrawnAuthors(authors: readonly Author[]): readonly Drawn[] {
  const listed = useListed();
  return authors.map((author) => ({ agent: isAgentIn(listed, author), name: author.name }));
}

export { useDrawnAuthors, useIsAgent };
