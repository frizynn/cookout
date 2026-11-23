import { dotPlace, messageClass } from "./message-class.ts";
import { AccentDot } from "./accent-dot.tsx";
import { DaySeparator } from "./day-separator.tsx";
import { MessageLayout } from "./message-layout.tsx";
import type { ReactNode } from "react";
import type { StandaloneMessageParts } from "./parts.ts";

export function StandaloneMessage(parts: StandaloneMessageParts): ReactNode {
  return (
    <>
      {parts.day !== null && <DaySeparator label={parts.day} />}
      <article aria-label={parts.label} className={messageClass(parts)} data-for-you={parts.mark === "for-you"}>
        {parts.mark === "for-you" && <AccentDot place={dotPlace(parts.grouped)} />}
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
    </>
  );
}
