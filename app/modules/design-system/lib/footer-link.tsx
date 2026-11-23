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
      className={`-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] ${linkStyle(parts.active)}`}
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
        <circle cx="8" cy="8" r="2.2" />
        <path
          d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
          strokeLinecap="round"
        />
      </svg>
      {parts.children}
    </a>
  );
}
