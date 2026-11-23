import type { ReactNode } from "react";

export function DotsIcon(): ReactNode {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  );
}
