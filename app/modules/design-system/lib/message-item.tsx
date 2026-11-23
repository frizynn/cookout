import { DaySeparator } from "./day-separator.tsx";
import type { MessageItemParts } from "./parts.ts";
import { MessageLayout } from "./message-layout.tsx";
import { NewLine } from "./new-line.tsx";
import type { ReactNode } from "react";
import { messageClass } from "./message-class.ts";
import { useRightClick } from "./use-right-click.ts";

const FOCUSABLE = 0;

export function MessageItem(parts: MessageItemParts): ReactNode {
  const article = useRightClick(parts.menu);
  const handleAction = parts.onAction;
  return (
    <li className="flex flex-col">
      {parts.day !== null && <DaySeparator label={parts.day} />}
      {parts.unreadLine && <NewLine />}
      <article
        aria-current={parts.mark === "open"}
        className={messageClass(parts)}
        data-for-you={parts.mark === "for-you"}
        ref={article}
        tabIndex={FOCUSABLE}
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
    </li>
  );
}
