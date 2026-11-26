import type { Identity, IdentityName } from "../../sdk/index.ts";
import { AvatarPicker } from "./avatar-picker.tsx";
import type { Composer } from "../../composer/index.ts";
import { ProfileSection } from "../../design-system/content.tsx";
import type { ReactNode } from "react";

interface ProfileAvatarProps {
  readonly composer: Composer;
  readonly identity: Identity;
  readonly me: IdentityName;
}

function settableBy(identity: Identity, me: IdentityName): boolean {
  if (identity.name === me) {
    return true;
  }
  return identity.kind === "agent" && identity.owner === String(me);
}

export function ProfileAvatar(props: ProfileAvatarProps): ReactNode {
  const { identity } = props;
  if (!settableBy(identity, props.me)) {
    return null;
  }
  return (
    <ProfileSection>
      <AvatarPicker name={identity.name} pick={props.composer.avatar(identity.name)} />
    </ProfileSection>
  );
}
