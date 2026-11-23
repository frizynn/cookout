import type { Author, Identity } from "../../sdk/index.ts";
import { useContext, useSyncExternalStore } from "react";
import { AuthorList } from "./author-list.ts";
import type { PresenceShown } from "./use-presence.ts";
import { usePresence } from "./use-presence.ts";
import { useProfileHref } from "./profile-base.ts";

const DEACTIVATED = "(deactivated)";

interface Shown {
  readonly agent: boolean;
  readonly displayName: string | null;
  readonly note: string | null;
}

interface ShownAuthor extends Shown {
  readonly presence: PresenceShown | null;
  readonly profileHref: string;
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

function noteOf(identity: Identity): string | null {
  if (identity.deactivated === true) {
    return DEACTIVATED;
  }
  return null;
}

function shownFrom(identity: Identity | null, author: Author): Shown {
  if (identity === null) {
    return { agent: "owner" in author, displayName: null, note: null };
  }
  return { agent: identity.kind === "agent", displayName: identity.displayName ?? null, note: noteOf(identity) };
}

function useListed(name: string): Identity | null {
  return listedIn(useEveryListed(), name);
}

function useAuthor(author: Author): ShownAuthor {
  const profileOf = useProfileHref();
  return {
    ...shownFrom(useListed(author.name), author),
    presence: usePresence(author.name),
    profileHref: profileOf(author.name),
  };
}

function useDrawnAuthors(authors: readonly Author[]): readonly Drawn[] {
  const listed = useEveryListed();
  return authors.map((author) => ({
    agent: shownFrom(listedIn(listed, author.name), author).agent,
    name: author.name,
  }));
}

export { noteOf, useAuthor, useDrawnAuthors, useListed };
