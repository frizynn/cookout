import { AuthorList } from "./author-list.ts";
import type { Identities } from "../../composer/index.ts";
import { IdentityCards } from "../../design-system/index.tsx";
import { PresenceList } from "./presence-list.ts";
import type { PresenceStore } from "../../presence-store/index.ts";
import type { ReactNode } from "react";
import { createIdentityCards } from "./identity-cards.ts";
import { useMemo } from "react";

interface AuthorsProps {
  readonly identities: Identities;
  readonly presence: PresenceStore;
  readonly children: ReactNode;
}

export function Authors(props: AuthorsProps): ReactNode {
  const { identities, presence } = props;
  const cards = useMemo(() => createIdentityCards({ identities, presence }), [identities, presence]);
  return (
    <AuthorList value={identities}>
      <PresenceList value={presence}>
        <IdentityCards value={cards}>{props.children}</IdentityCards>
      </PresenceList>
    </AuthorList>
  );
}
