import type { ReactNode } from "react";

const HASH = "#";

interface NavLabelParts {
  readonly label: string;
}

export function NavLabel(parts: NavLabelParts): ReactNode {
  if (!parts.label.startsWith(HASH)) {
    return parts.label;
  }
  return (
    <>
      <span className="mr-0.5 font-normal text-muted-foreground">{HASH}</span>
      {parts.label.slice(HASH.length)}
    </>
  );
}
