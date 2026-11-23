import type { AccountLinkParts } from "./parts.ts";
import { Author } from "./author.tsx";
import type { ReactNode } from "react";

function currentOf(active: boolean): "page" | false {
  if (active) {
    return "page";
  }
  return false;
}

export function AccountLink(parts: AccountLinkParts): ReactNode {
  return (
    <a
      aria-current={currentOf(parts.active)}
      className="-mx-2 flex rounded-md px-2 py-1 hover:bg-hover"
      href={parts.href}
    >
      <Author agent={parts.agent} name={parts.name} shown={parts.name} />
    </a>
  );
}
