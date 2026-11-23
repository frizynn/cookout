import type { ReactNode } from "react";

interface NavHeadingParts {
  readonly label: string;
  readonly children?: ReactNode;
}

export function NavHeading(parts: NavHeadingParts): ReactNode {
  return (
    <div className="flex items-center justify-between pt-5 pr-3 pb-1.5 pl-4">
      <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{parts.label}</h2>
      {parts.children}
    </div>
  );
}
