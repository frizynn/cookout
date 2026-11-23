import type { Identity, IdentityName } from "../../sdk/index.ts";
import type { Composer } from "../../composer/index.ts";
import { DisplayNameField } from "./display-name-field.tsx";
import { Muted } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const TEXT = { description: "Description", subject: "description" } as const;

interface ProfileDescriptionProps {
  readonly composer: Composer;
  readonly identity: Identity;
  readonly me: IdentityName;
}

function editableBy(identity: Identity, me: IdentityName, listed: readonly Identity[]): boolean {
  if (identity.kind !== "agent") {
    return false;
  }
  return identity.owner === String(me) || listed.some((each) => each.name === me && each.admin);
}

function descriptionOf(identity: Identity): string | null {
  if (identity.kind === "agent") {
    return identity.description ?? null;
  }
  return null;
}

export function ProfileDescription(props: ProfileDescriptionProps): ReactNode {
  const { identities } = props.composer;
  const { identity } = props;
  const listed = useSyncExternalStore(identities.subscribe, identities.snapshot);
  const saved = descriptionOf(identity);
  if (editableBy(identity, props.me, listed)) {
    return (
      <DisplayNameField
        draft={props.composer.description(identity.name)}
        field={TEXT.description}
        label={TEXT.description}
        saved={saved}
        subject={TEXT.subject}
      />
    );
  }
  return saved !== null && <Muted>{saved}</Muted>;
}
