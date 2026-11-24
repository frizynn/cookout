import type { HoverActionsParts } from "./menu-parts.ts";
import { HoverLead } from "./hover-lead.tsx";
import { MoreActions } from "./more-actions.tsx";
import { ReactButton } from "./react-button.tsx";
import type { ReactNode } from "react";

export function HoverButtons(parts: HoverActionsParts): ReactNode {
  const { actionHref, choices, onAction, reactions } = parts;
  const handleAction = onAction;
  return (
    <div className="invisible absolute top-1 right-4 flex gap-1 group-focus-within:visible group-hover:visible has-data-[state=open]:visible">
      {reactions.map((choice) => (
        <ReactButton choice={choice} key={choice.symbol} />
      ))}
      <HoverLead
        actionHref={actionHref}
        actionLabel={parts.actionLabel}
        onAction={handleAction}
        thread={parts.thread}
      />
      <MoreActions choices={choices} />
    </div>
  );
}
