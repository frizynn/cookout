import type { ReactNode } from "react";

interface BackLinkParts {
  readonly href: string;
  readonly label: string;
}

export function BackLink(parts: BackLinkParts): ReactNode {
  return (
    <a
      aria-label={parts.label}
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
      href={parts.href}
    >
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        viewBox="0 0 16 16"
      >
        <path d="M13 8H3M7.5 3.5L3 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
