import { GearIcon } from "./gear-icon.tsx";
import type { ReactNode } from "react";

interface FooterLinkParts {
  readonly href: string;
  readonly active: boolean;
  readonly children: ReactNode;
}

function linkStyle(active: boolean): string {
  if (active) {
    return "bg-accent text-foreground";
  }
  return "text-muted-foreground hover:bg-hover hover:text-foreground";
}

function currentOf(active: boolean): "page" | false {
  if (active) {
    return "page";
  }
  return false;
}

export function FooterLink(parts: FooterLinkParts): ReactNode {
  return (
    <a
      aria-current={currentOf(parts.active)}
      className={`-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] [&>svg]:h-3.5 [&>svg]:w-3.5 ${linkStyle(parts.active)}`}
      href={parts.href}
    >
      <GearIcon />
      {parts.children}
    </a>
  );
}
