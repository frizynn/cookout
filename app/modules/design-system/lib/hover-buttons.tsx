import type { HoverActionsParts } from "./menu-parts.ts";
import { HoverThread } from "./hover-thread.tsx";
import { MessageAction } from "./message-action.tsx";
import { MoreActions } from "./more-actions.tsx";
import { ReactButton } from "./react-button.tsx";
import type { ReactNode } from "react";

const TEXT = { label: "Quick actions", more: "More actions" } as const;

export function HoverButtons(parts: HoverActionsParts): ReactNode {
  const { actionHref, choices, onAction, reactions, thread } = parts;
  const handleAction = onAction;
  return (
    <fieldset
      aria-label={TEXT.label}
      className="invisible absolute top-1 right-4 flex gap-1 opacity-0 transition-[opacity,visibility] duration-100 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 group-has-focus-visible:visible group-has-focus-visible:opacity-100 has-focus:visible has-focus:opacity-100 has-data-[state=open]:visible has-data-[state=open]:opacity-100 pointer-coarse:hidden"
    >
      {reactions
        .filter((choice) => choice.inHoverBar)
        .map((choice) => (
          <ReactButton choice={choice} key={choice.symbol} />
        ))}
      {parts.replyOnHover && (
        <MessageAction actionHref={actionHref} actionLabel={parts.actionLabel} onAction={handleAction} />
      )}
      {thread !== null && <HoverThread thread={thread} />}
      <MoreActions choices={choices} label={TEXT.more} />
    </fieldset>
  );
}
