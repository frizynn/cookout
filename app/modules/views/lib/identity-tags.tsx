import type { Identity } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import { Tag } from "../../design-system/index.tsx";

const TEXT = { admin: "admin", agent: "agent" } as const;

interface IdentityTagsProps {
  readonly identity: Identity;
}

export function IdentityTags(props: IdentityTagsProps): ReactNode {
  const { identity } = props;
  return (
    <>
      {identity.kind === "agent" && <Tag label={TEXT.agent} />}
      {identity.admin && <Tag label={TEXT.admin} />}
    </>
  );
}
