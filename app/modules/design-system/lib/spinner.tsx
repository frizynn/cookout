import type { ReactNode } from "react";

export function Spinner(): ReactNode {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 16 16">
      <circle className="opacity-25" cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}
