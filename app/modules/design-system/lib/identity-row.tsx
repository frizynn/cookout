import { Avatar } from "./avatar.tsx";
import type { IdentityRowParts } from "./parts.ts";
import { IdentityRowText } from "./identity-row-text.tsx";
import type { ReactNode } from "react";
import { presenceNameOf } from "./presence-name.ts";

function rowStyle(active: boolean): string {
  if (active) {
    return "bg-accent";
  }
  return "hover:bg-hover";
}

function currentOf(active: boolean): "page" | false {
  if (active) {
    return "page";
  }
  return false;
}

export function IdentityRow(parts: IdentityRowParts): ReactNode {
  return (
    <li>
      <a
        aria-current={currentOf(parts.active)}
        aria-label={presenceNameOf({ name: parts.displayName ?? parts.name, presence: parts.presence })}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${rowStyle(parts.active)}`}
        href={parts.href}
      >
        <Avatar agent={parts.agent} name={parts.name} presence={parts.presence} />
        <IdentityRowText row={parts} />
      </a>
    </li>
  );
}
