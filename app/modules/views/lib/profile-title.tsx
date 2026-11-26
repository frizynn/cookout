import { ProfileHead, ProfileName } from "../../design-system/content.tsx";
import type { EditAction } from "../../design-system/content.tsx";
import type { Identity } from "../../sdk/index.ts";
import { IdentityTags } from "./identity-tags.tsx";
import { ProfileFacts } from "./profile-facts.tsx";
import type { ReactNode } from "react";
import { noteOf } from "./use-author.ts";

interface ProfileTitleProps {
  readonly identity: Identity;
  readonly edit: EditAction | null;
}

export function ProfileTitle(props: ProfileTitleProps): ReactNode {
  const { identity } = props;
  return (
    <ProfileHead>
      <ProfileName
        displayName={identity.displayName ?? null}
        edit={props.edit}
        name={identity.name}
        note={noteOf(identity)}
      >
        <IdentityTags identity={identity} />
      </ProfileName>
      <ProfileFacts identity={identity} />
    </ProfileHead>
  );
}
