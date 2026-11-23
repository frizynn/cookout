import { CardBody, Muted, Profile, ProfileName, Skeleton } from "../../design-system/index.tsx";
import { shownIn, usePresences } from "./use-presence.ts";
import type { Composer } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import { IdentityTags } from "./identity-tags.tsx";
import { ProfileControls } from "./profile-controls.tsx";
import { ProfileFacts } from "./profile-facts.tsx";
import { ProfileTexts } from "./profile-texts.tsx";
import type { ReactNode } from "react";
import { noteOf } from "./use-author.ts";
import { useSyncExternalStore } from "react";

const NONE = 0;

const TEXT = { unknown: "Unknown identity" } as const;

interface ProfileBodyProps {
  readonly composer: Composer;
  readonly me: IdentityName;
  readonly name: IdentityName;
}

export function ProfileBody(props: ProfileBodyProps): ReactNode {
  const { identities } = props.composer;
  const listed = useSyncExternalStore(identities.subscribe, identities.snapshot);
  const found = listed.filter((each) => each.name === props.name);
  const presences = usePresences();
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
    <Profile
      agent={identity.kind === "agent"}
      key={identity.name}
      name={identity.name}
      presence={shownIn({ name: identity.name, presences })}
    >
      <ProfileName displayName={identity.displayName ?? null} name={identity.name} note={noteOf(identity)}>
        <IdentityTags identity={identity} />
      </ProfileName>
      <ProfileFacts identity={identity} />
      <ProfileTexts composer={props.composer} identity={identity} me={props.me} />
      <ProfileControls identities={identities} identity={identity} me={props.me} />
    </Profile>
  ));
}
