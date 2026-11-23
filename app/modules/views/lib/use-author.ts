import type { Author, Identity } from "../../sdk/index.ts";
import { useContext, useSyncExternalStore } from "react";
import { AuthorList } from "./author-list.ts";

interface Shown {
  readonly agent: boolean;
  readonly displayName: string | null;
}

interface Drawn {
  readonly name: string;
  readonly agent: boolean;
}

function useEveryListed(): readonly Identity[] {
  const identities = useContext(AuthorList);
  return useSyncExternalStore(identities.subscribe, identities.snapshot);
}

function listedIn(listed: readonly Identity[], name: string): Identity | null {
  return listed.find((identity) => identity.name === name) ?? null;
}

function shownFrom(identity: Identity | null, author: Author): Shown {
  if (identity === null) {
    return { agent: "owner" in author, displayName: null };
  }
  return { agent: identity.kind === "agent", displayName: identity.displayName ?? null };
}

function useListed(name: string): Identity | null {
  return listedIn(useEveryListed(), name);
}

function useAuthor(author: Author): Shown {
  return shownFrom(useListed(author.name), author);
}

function useDrawnAuthors(authors: readonly Author[]): readonly Drawn[] {
  const listed = useEveryListed();
  return authors.map((author) => ({
    agent: shownFrom(listedIn(listed, author.name), author).agent,
    name: author.name,
  }));
}

export { useAuthor, useDrawnAuthors, useListed };
