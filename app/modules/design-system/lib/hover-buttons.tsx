import type { HoverActionsParts } from "./menu-parts.ts";
import { MessageAction } from "./message-action.tsx";
import { MoreActions } from "./more-actions.tsx";
import { ReactButton } from "./react-button.tsx";
import type { ReactNode } from "react";

export function HoverButtons(parts: HoverActionsParts): ReactNode {
  const { actionHref, choices, onAction, reactions } = parts;
  const handleAction = onAction;
  return (
    <div className="invisible absolute top-1 right-4 flex gap-1 group-focus-within:visible group-hover:visible">
      {reactions.map((choice) => (
        <ReactButton choice={choice} key={choice.symbol} />
      ))}
      <MessageAction actionHref={actionHref} actionLabel={parts.actionLabel} onAction={handleAction} />
      <MoreActions choices={choices} />
    </div>
  );
}
