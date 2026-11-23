import type { Identity, IdentityName } from "../../sdk/index.ts";
import type { Composer } from "../../composer/index.ts";
import { DisplayNameField } from "./display-name-field.tsx";
import type { ReactNode } from "react";

const TEXT = { displayName: "Display name" } as const;

interface ProfileDisplayNameProps {
  readonly composer: Composer;
  readonly identity: Identity;
  readonly me: IdentityName;
}

function editableBy(identity: Identity, me: IdentityName): boolean {
  if (identity.name === me) {
    return true;
  }
  return identity.kind === "agent" && identity.owner === String(me);
}

export function ProfileDisplayName(props: ProfileDisplayNameProps): ReactNode {
  const { identity } = props;
  if (!editableBy(identity, props.me)) {
    return null;
  }
  return (
    <DisplayNameField
      draft={props.composer.displayName(identity.name)}
      field={TEXT.displayName}
      label={TEXT.displayName}
      saved={identity.displayName ?? null}
    />
  );
}
