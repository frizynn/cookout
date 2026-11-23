import { DaySeparator } from "./day-separator.tsx";
import { MessageLayout } from "./message-layout.tsx";
import type { ReactNode } from "react";
import type { StandaloneMessageParts } from "./parts.ts";
import { messageClass } from "./message-class.ts";

export function StandaloneMessage(parts: StandaloneMessageParts): ReactNode {
  return (
    <>
      {parts.day !== null && <DaySeparator label={parts.day} />}
      <article aria-label={parts.label} className={messageClass(parts)} data-mentions-me={parts.mark === "mention"}>
        <MessageLayout
          actionHref={parts.actionHref}
          actionLabel={parts.actionLabel}
          agent={parts.agent}
          displayName={parts.displayName}
          grouped={parts.grouped}
          name={parts.name}
          note={parts.note}
          time={parts.time}
        >
          {parts.children}
        </MessageLayout>
      </article>
    </>
  );
}
