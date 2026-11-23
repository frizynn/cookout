import { HoverAction } from "./hover-action.tsx";
import type { HoverActionsParts } from "./menu-parts.ts";
import { MoreActions } from "./more-actions.tsx";
import type { ReactNode } from "react";

export function HoverButtons(parts: HoverActionsParts): ReactNode {
  const { actionHref, menu } = parts;
  if (actionHref === null && menu === null) {
    return null;
  }
  return (
    <div className="invisible absolute top-1 right-4 flex gap-1 group-focus-within:visible group-hover:visible">
      {actionHref !== null && <HoverAction href={actionHref}>{parts.actionLabel}</HoverAction>}
      {menu !== null && <MoreActions menu={menu} />}
    </div>
  );
}
