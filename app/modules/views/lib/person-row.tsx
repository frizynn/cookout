import type { Identity, IdentityName } from "../../sdk/index.ts";
import { IdentityRow } from "../../design-system/index.tsx";
import { IdentityTags } from "./identity-tags.tsx";
import type { ReactNode } from "react";
import { hrefOf } from "../../paths/index.ts";
import { kindOf } from "./kind-of.ts";

const TEXT = { you: "(you)" } as const;

interface PersonRowProps {
  readonly identity: Identity;
  readonly me: IdentityName;
  readonly open: IdentityName | null;
}

function noteOf(identity: Identity, me: IdentityName): string | null {
  if (identity.name === me) {
    return TEXT.you;
  }
  return null;
}

export function PersonRow(props: PersonRowProps): ReactNode {
  const { identity } = props;
  return (
    <IdentityRow
      active={identity.name === props.open}
      agent={identity.kind === "agent"}
      detail={kindOf(identity)}
      href={hrefOf({ identity: identity.name, name: "profile" })}
      name={identity.name}
      note={noteOf(identity, props.me)}
    >
      <IdentityTags identity={identity} />
    </IdentityRow>
  );
}
