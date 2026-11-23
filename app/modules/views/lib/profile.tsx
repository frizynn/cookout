import type { Identities } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import { ProfileBody } from "./profile-body.tsx";
import type { ReactNode } from "react";
import { SidePanel } from "../../design-system/index.tsx";
import { hrefOf } from "../../paths/index.ts";

const TEXT = { close: "Close profile", profile: "Profile" } as const;

interface ProfileProps {
  readonly identities: Identities;
  readonly me: IdentityName;
  readonly name: IdentityName;
}

export function ProfileView(props: ProfileProps): ReactNode {
  return (
    <SidePanel closeHref={hrefOf({ name: "people" })} closeLabel={TEXT.close} detail={props.name} label={TEXT.profile}>
      <ProfileBody identities={props.identities} me={props.me} name={props.name} />
    </SidePanel>
  );
}
