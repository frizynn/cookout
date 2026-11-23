import { DaySeparator } from "./day-separator.tsx";
import { MessageLayout } from "./message-layout.tsx";
import type { ReactNode } from "react";
import type { StandaloneMessageParts } from "./parts.ts";
import { messageClass } from "./message-class.ts";
import { useRightClick } from "./use-right-click.ts";

export function StandaloneMessage(parts: StandaloneMessageParts): ReactNode {
  const article = useRightClick(parts.menu);
  const handleAction = parts.onAction;
  return (
    <>
      {parts.day !== null && <DaySeparator label={parts.day} />}
      <article
        aria-label={parts.label}
        className={messageClass(parts)}
        data-for-you={parts.mark === "for-you"}
        ref={article}
      >
        <MessageLayout
          actionHref={parts.actionHref}
          actionLabel={parts.actionLabel}
          agent={parts.agent}
          displayName={parts.displayName}
          grouped={parts.grouped}
          menu={parts.menu}
          name={parts.name}
          nameHref={parts.nameHref}
          note={parts.note}
          onAction={handleAction}
          presence={parts.presence}
          time={parts.time}
        >
          {parts.children}
        </MessageLayout>
      </article>
    </>
  );
}
