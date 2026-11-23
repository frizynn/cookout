import { AuthorList } from "./author-list.ts";
import type { Identities } from "../../composer/index.ts";
import { PresenceList } from "./presence-list.ts";
import type { PresenceStore } from "../../presence-store/index.ts";
import type { ReactNode } from "react";

interface AuthorsProps {
  readonly identities: Identities;
  readonly presence: PresenceStore;
  readonly children: ReactNode;
}

export function Authors(props: AuthorsProps): ReactNode {
  return (
    <AuthorList value={props.identities}>
      <PresenceList value={props.presence}>{props.children}</PresenceList>
    </AuthorList>
  );
}
