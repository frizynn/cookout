import type { MessageActionParts, ThreadChoice } from "./menu-parts.ts";
import { HoverButton } from "./hover-button.tsx";
import { MessageAction } from "./message-action.tsx";
import type { ReactNode } from "react";

interface HoverLeadParts extends MessageActionParts {
  readonly thread: ThreadChoice | null;
}

export function HoverLead(parts: HoverLeadParts): ReactNode {
  const { thread } = parts;
  const handleAction = parts.onAction;
  if (thread === null) {
    return <MessageAction actionHref={parts.actionHref} actionLabel={parts.actionLabel} onAction={handleAction} />;
  }
  const handleThread = thread.onSelect;
  return (
    <HoverButton name={thread.name} onClick={handleThread}>
      {thread.label}
    </HoverButton>
  );
}
