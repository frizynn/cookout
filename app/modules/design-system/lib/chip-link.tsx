import type { ReactNode } from "react";

interface ChipLinkParts {
  readonly children: ReactNode;
  readonly current: boolean;
  readonly href: string;
}

function chipStyle(current: boolean): string {
  if (current) {
    return "border-foreground bg-foreground text-background";
  }
  return "text-muted-foreground hover:text-foreground";
}

function currentOf(current: boolean): "page" | false {
  if (current) {
    return "page";
  }
  return false;
}

export function ChipLink(parts: ChipLinkParts): ReactNode {
  return (
    <a
      aria-current={currentOf(parts.current)}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${chipStyle(parts.current)}`}
      href={parts.href}
    >
      {parts.children}
    </a>
  );
}
