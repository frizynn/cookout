import type { Identity, IdentityName } from "../../sdk/index.ts";
import type { Identities } from "../../composer/index.ts";
import { IdentityActionsView } from "./identity-actions.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

interface ProfileActionsProps {
  readonly identities: Identities;
  readonly identity: Identity;
  readonly me: IdentityName;
}

function ownedByMe(identity: Identity, me: IdentityName): boolean {
  return identity.kind === "agent" && identity.owner === String(me);
}

export function ProfileActions(props: ProfileActionsProps): ReactNode {
  const { identities, identity, me } = props;
  const listed = useSyncExternalStore(identities.subscribe, identities.snapshot);
  const admin = listed.some((each) => each.name === me && each.admin);
  if (identity.name === me || !(admin || ownedByMe(identity, me))) {
    return null;
  }
  const ownsAgents = listed.some((each) => each.kind === "agent" && each.owner === String(identity.name));
  return (
    <IdentityActionsView
      deletable={admin && !ownsAgents}
      identities={identities}
      identity={identity}
      transfer={admin}
    />
  );
}
