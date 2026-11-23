import type { HoverActionsParts } from "./menu-parts.ts";
import { HoverButtons } from "./hover-buttons.tsx";
import { MessageMenu } from "./message-menu.tsx";
import type { ReactNode } from "react";

export function HoverActions(parts: HoverActionsParts): ReactNode {
  const { actionHref, menu } = parts;
  const handleAction = parts.onAction;
  return (
    <>
      <HoverButtons actionHref={actionHref} actionLabel={parts.actionLabel} menu={menu} onAction={handleAction} />
      {menu !== null && menu.open && (
        <MessageMenu actionHref={actionHref} actionLabel={parts.actionLabel} menu={menu} onAction={handleAction} />
      )}
    </>
  );
}
