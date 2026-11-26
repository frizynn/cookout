import { Profile } from "../../design-system/content.tsx";
import { ProfileAvatar } from "./profile-avatar.tsx";
import { ProfileControls } from "./profile-controls.tsx";
import { ProfileHeading } from "./profile-heading.tsx";
import type { ProfileHeadingProps } from "./profile-heading.tsx";
import { ProfileTexts } from "./profile-texts.tsx";
import type { ReactNode } from "react";
import { shownIn } from "./use-presence.ts";
import { useAvatarEdit } from "./use-avatar-edit.ts";
import type { usePresences } from "./use-presence.ts";

interface ProfileEntryProps extends ProfileHeadingProps {
  readonly presences: ReturnType<typeof usePresences>;
}

export function ProfileEntry(props: ProfileEntryProps): ReactNode {
  const { identity } = props;
  const avatar = useAvatarEdit({ composer: props.composer, identity, me: props.me });
  const handleAvatarClose = avatar.close;
  return (
    <Profile
      agent={identity.kind === "agent"}
      edit={avatar.edit}
      name={identity.name}
      presence={shownIn({ name: identity.name, presences: props.presences })}
    >
      <ProfileHeading composer={props.composer} identity={identity} keymap={props.keymap} me={props.me} />
      <ProfileTexts composer={props.composer} identity={identity} me={props.me} />
      <ProfileControls identities={props.composer.identities} identity={identity} me={props.me} />
      <ProfileAvatar name={identity.name} onClose={handleAvatarClose} open={avatar.open} pick={avatar.pick} />
    </Profile>
  );
}
