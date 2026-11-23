import { Author } from "./author.tsx";
import type { IdentityLinkParts } from "./parts.ts";
import type { ReactNode } from "react";
import { presenceNameOf } from "./presence-name.ts";

function currentOf(active: boolean): "page" | false {
  if (active) {
    return "page";
  }
  return false;
}

export function IdentityLink(parts: IdentityLinkParts): ReactNode {
  const { displayName, name } = parts;
  return (
    <a
      aria-current={currentOf(parts.active)}
      aria-label={presenceNameOf({ name: displayName ?? name, presence: parts.presence })}
      className="-mx-2 flex rounded-md px-2 py-1 hover:bg-hover"
      href={parts.href}
    >
      {displayName === null && (
        <Author agent={parts.agent} handle={null} presence={parts.presence} name={name} shown={name} />
      )}
      {displayName !== null && (
        <Author agent={parts.agent} handle={`@${name}`} presence={parts.presence} name={name} shown={displayName} />
      )}
    </a>
  );
}
