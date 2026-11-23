import type { Identity, IdentityName } from "../../sdk/index.ts";
import { AdminToggle } from "./admin-toggle.tsx";
import type { Identities } from "../../composer/index.ts";
import { ProfileActions } from "./profile-actions.tsx";
import type { ReactNode } from "react";

interface ProfileControlsProps {
  readonly identities: Identities;
  readonly identity: Identity;
  readonly me: IdentityName;
}

export function ProfileControls(props: ProfileControlsProps): ReactNode {
  return (
    <>
      <AdminToggle identities={props.identities} identity={props.identity} me={props.me} />
      <ProfileActions identities={props.identities} identity={props.identity} me={props.me} />
    </>
  );
}
