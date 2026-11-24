import { ChatIcon } from "./chat-icon.tsx";
import { HoverAction } from "./hover-action.tsx";
import { MessageKeys } from "./message-keys-parts.ts";
import type { ReactNode } from "react";
import { useContext } from "react";

const TEXT = { openThread: "Open thread" } as const;

interface HoverOpenThreadParts {
  readonly href: string;
}

export function HoverOpenThread(parts: HoverOpenThreadParts): ReactNode {
  const { keys } = useContext(MessageKeys).openThread;
  return (
    <HoverAction href={parts.href} keys={keys} name={TEXT.openThread}>
      <ChatIcon />
    </HoverAction>
  );
}
