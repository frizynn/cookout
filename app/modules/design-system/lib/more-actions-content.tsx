import { Content, Item } from "@radix-ui/react-dropdown-menu";
import type { MenuChoice as Choice } from "./menu-parts.ts";
import { MENU } from "./menu-style.ts";
import { MenuChoice } from "./menu-choice.tsx";
import type { ReactNode } from "react";
import { useAfterClose } from "./use-after-close.ts";

interface MoreActionsContentParts {
  readonly choices: readonly Choice[];
}

export function MoreActionsContent(parts: MoreActionsContentParts): ReactNode {
  const after = useAfterClose();
  const handleChoose = after.onChoose;
  const handleCloseAutoFocus = after.onCloseAutoFocus;
  return (
    <Content align="end" asChild onCloseAutoFocus={handleCloseAutoFocus}>
      <div className={MENU}>
        {parts.choices.map((choice) => (
          <MenuChoice choice={choice} item={Item} key={choice.label} onChoose={handleChoose} />
        ))}
      </div>
    </Content>
  );
}
