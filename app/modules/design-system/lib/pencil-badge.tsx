import { PencilIcon } from "./pencil-icon.tsx";
import type { ReactNode } from "react";

const BADGE =
  "absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border bg-background text-foreground shadow-sm transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/edit:opacity-100 pointer-fine:group-focus-visible/edit:opacity-100 [&>svg]:h-3.5 [&>svg]:w-3.5";

export function PencilBadge(): ReactNode {
  return (
    <span aria-hidden="true" className={BADGE}>
      <PencilIcon />
    </span>
  );
}
