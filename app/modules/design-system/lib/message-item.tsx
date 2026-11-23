import { DaySeparator } from "./day-separator.tsx";
import type { MessageItemParts } from "./parts.ts";
import { MessageLayout } from "./message-layout.tsx";
import { NewLine } from "./new-line.tsx";
import type { ReactNode } from "react";
import { messageClass } from "./message-class.ts";
import { useCallback } from "react";
import { useListener } from "./use-listener.ts";

const FOCUSABLE = 0;

export function MessageItem(parts: MessageItemParts): ReactNode {
  const { menu } = parts;
  const opened = useCallback(
    (event: MouseEvent) => {
      if (menu !== null) {
        event.preventDefault();
        menu.onOpen();
      }
    },
    [menu],
  );
  const article = useListener<HTMLElement, "contextmenu">({ listener: opened, type: "contextmenu" });
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
          time={parts.time}
        >
          {parts.children}
        </MessageLayout>
      </article>
    </li>
  );
}
