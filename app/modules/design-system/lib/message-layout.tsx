import { Avatar } from "./avatar.tsx";
import { HoverAction } from "./hover-action.tsx";
import { MessageHeader } from "./message-header.tsx";
import type { MessageLayoutParts } from "./parts.ts";
import { MessageTime } from "./message-time.tsx";
import type { ReactNode } from "react";

export function MessageLayout(parts: MessageLayoutParts): ReactNode {
  const { time } = parts;
  return (
    <>
      <div className="flex w-9 shrink-0 justify-center">
        {parts.grouped && <MessageTime full={time.full} hidden iso={time.iso} shown={time.short} />}
        {!parts.grouped && <Avatar agent={parts.agent} name={parts.name} />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {!parts.grouped && (
          <MessageHeader
            agent={parts.agent}
            displayName={parts.displayName}
            name={parts.name}
            note={parts.note}
            time={time}
          />
        )}
        {parts.children}
      </div>
      {parts.actionHref !== null && (
        <div className="invisible absolute top-1 right-4 group-focus-within:visible group-hover:visible">
          <HoverAction href={parts.actionHref}>{parts.actionLabel}</HoverAction>
        </div>
      )}
    </>
  );
}
