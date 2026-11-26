import type { Identity, IdentityName } from "../../sdk/index.ts";
import type { Composer } from "../../composer/index.ts";
import type { Keymap } from "../../keymap/index.ts";
import { ProfileDisplayName } from "./profile-display-name.tsx";
import { ProfileTitle } from "./profile-title.tsx";
import type { ReactNode } from "react";
import { useNameEdit } from "./use-name-edit.ts";

interface ProfileHeadingProps {
  readonly composer: Composer;
  readonly identity: Identity;
  readonly keymap: Keymap;
  readonly me: IdentityName;
}

export function ProfileHeading(props: ProfileHeadingProps): ReactNode {
  const { identity } = props;
  const name = useNameEdit({ composer: props.composer, identity, me: props.me });
  const handleClose = name.close;
  return (
    <>
      <ProfileTitle edit={name.edit} identity={identity} />
      {name.open && (
        <ProfileDisplayName composer={props.composer} identity={identity} keymap={props.keymap} onClose={handleClose} />
      )}
    </>
  );
}

export type { ProfileHeadingProps };
