import { Portal, Root, Trigger } from "@radix-ui/react-context-menu";
import { ContextMenuContent } from "./context-menu-content.tsx";
import type { MenuChoice } from "./menu-parts.ts";
import type { ReactNode } from "react";

interface MessageContextMenuParts {
  readonly choices: readonly MenuChoice[] | null;
  readonly children: ReactNode;
}

export function MessageContextMenu(parts: MessageContextMenuParts): ReactNode {
  const { choices } = parts;
  if (choices === null) {
    return parts.children;
  }
  return (
    <Root>
      <Trigger asChild>{parts.children}</Trigger>
      <Portal>
        <ContextMenuContent choices={choices} />
      </Portal>
    </Root>
  );
}
