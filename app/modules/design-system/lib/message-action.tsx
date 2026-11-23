import { HoverAction } from "./hover-action.tsx";
import { HoverButton } from "./hover-button.tsx";
import type { ReactNode } from "react";

interface MessageActionParts {
  readonly actionHref: string | null;
  readonly actionLabel: string;
  readonly onAction: (() => void) | null;
}

export function MessageAction(parts: MessageActionParts): ReactNode {
  const { actionHref, onAction } = parts;
  if (actionHref !== null) {
    return <HoverAction href={actionHref}>{parts.actionLabel}</HoverAction>;
  }
  if (onAction === null) {
    return null;
  }
  const handleAction = onAction;
  return <HoverButton onClick={handleAction}>{parts.actionLabel}</HoverButton>;
}
