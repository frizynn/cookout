import type { ReactNode } from "react";

const TEXT = { collapse: "Collapse sidebar", expand: "Expand sidebar" } as const;

interface CollapseButtonParts {
  readonly collapsed: boolean;
  readonly onClick: () => void;
}

function labelOf(collapsed: boolean): string {
  if (collapsed) {
    return TEXT.expand;
  }
  return TEXT.collapse;
}

function arrowOf(collapsed: boolean): string {
  if (collapsed) {
    return "M6 4l4 4-4 4";
  }
  return "M10 4l-4 4 4 4";
}

export function CollapseButton(parts: CollapseButtonParts): ReactNode {
  const handleClick = parts.onClick;
  return (
    <button
      aria-expanded={!parts.collapsed}
      aria-label={labelOf(parts.collapsed)}
      className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
      onClick={handleClick}
      title={labelOf(parts.collapsed)}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        viewBox="0 0 16 16"
      >
        <path d={arrowOf(parts.collapsed)} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
