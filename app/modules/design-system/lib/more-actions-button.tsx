import { DotsIcon } from "./dots-icon.tsx";
import type { ReactNode } from "react";
import { Trigger } from "@radix-ui/react-dropdown-menu";

const TEXT = { label: "More actions" } as const;

export function MoreActionsButton(): ReactNode {
  return (
    <Trigger asChild>
      <button
        aria-label={TEXT.label}
        className="block rounded-md border bg-background px-1.5 py-0.5 text-muted-foreground shadow-sm hover:text-foreground focus-visible:text-foreground"
        type="button"
      >
        <DotsIcon />
      </button>
    </Trigger>
  );
}
