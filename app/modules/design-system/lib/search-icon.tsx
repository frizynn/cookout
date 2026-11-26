import type { ReactNode } from "react";

export function SearchIcon(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-1/2 h-4 w-4 -translate-1/2 text-muted-foreground group-focus-within/search:hidden md:hidden"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
    >
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.25 10.25L13.5 13.5" strokeLinecap="round" />
    </svg>
  );
}
