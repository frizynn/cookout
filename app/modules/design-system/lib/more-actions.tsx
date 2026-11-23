import { Portal, Root } from "@radix-ui/react-dropdown-menu";
import type { MenuChoice } from "./menu-parts.ts";
import { MoreActionsButton } from "./more-actions-button.tsx";
import { MoreActionsContent } from "./more-actions-content.tsx";
import type { ReactNode } from "react";

interface MoreActionsParts {
  readonly choices: readonly MenuChoice[];
}

export function MoreActions(parts: MoreActionsParts): ReactNode {
  return (
    <Root>
      <MoreActionsButton />
      <Portal>
        <MoreActionsContent choices={parts.choices} />
      </Portal>
    </Root>
  );
}
