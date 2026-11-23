import { CardBody, DateText, Muted, Profile, ProfileName, Skeleton } from "../../design-system/index.tsx";
import { AdminToggle } from "./admin-toggle.tsx";
import type { Identities } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import { IdentityTags } from "./identity-tags.tsx";
import type { ReactNode } from "react";
import { kindOf } from "./kind-of.ts";
import { useSyncExternalStore } from "react";

const NONE = 0;

const TEXT = { joined: "joined ", unknown: "Unknown identity" } as const;

interface ProfileBodyProps {
  readonly identities: Identities;
  readonly me: IdentityName;
  readonly name: IdentityName;
}

export function ProfileBody(props: ProfileBodyProps): ReactNode {
  const listed = useSyncExternalStore(props.identities.subscribe, props.identities.snapshot);
  const found = listed.filter((each) => each.name === props.name);
  if (listed.length === NONE) {
    return (
      <CardBody>
        <Skeleton width="short" />
      </CardBody>
    );
  }
  if (found.length === NONE) {
    return (
      <CardBody>
        <Muted>{TEXT.unknown}</Muted>
      </CardBody>
    );
  }
  return found.map((identity) => (
    <Profile agent={identity.kind === "agent"} key={identity.name} name={identity.name}>
      <ProfileName displayName={identity.displayName ?? null} name={identity.name}>
        <IdentityTags identity={identity} />
      </ProfileName>
      <Muted>{kindOf(identity)}</Muted>
      <Muted>
        {TEXT.joined}
        <DateText time={identity.createdAt} />
      </Muted>
      <AdminToggle identities={props.identities} identity={identity} me={props.me} />
    </Profile>
  ));
}
