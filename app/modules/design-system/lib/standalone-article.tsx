import { MessageContextMenu } from "./message-context-menu.tsx";
import { MessageLayout } from "./message-layout.tsx";
import type { ReactNode } from "react";
import type { StandaloneMessageParts } from "./parts.ts";
import { messageClass } from "./message-class.ts";
import { useMessageChoices } from "./message-choices.ts";
import { useScrollWhenLinked } from "./use-scroll-when-linked.ts";

interface StandaloneArticleParts {
  readonly message: StandaloneMessageParts;
}

export function StandaloneArticle(parts: StandaloneArticleParts): ReactNode {
  const { message } = parts;
  const handleAction = message.onAction;
  const choices = useMessageChoices({
    actionHref: message.actionHref,
    actionLabel: message.actionLabel,
    menu: message.menu,
    onAction: handleAction,
  });
  const article = useScrollWhenLinked({ linked: message.mark === "linked", reactions: message.menu.reactions });
  return (
    <MessageContextMenu choices={choices}>
      <article
        aria-current={message.mark === "linked"}
        aria-label={message.label}
        className={messageClass(message)}
        data-for-you={message.mark === "for-you"}
        ref={article}
      >
        <MessageLayout
          actionHref={message.actionHref}
          actionLabel={message.actionLabel}
          agent={message.agent}
          displayName={message.displayName}
          grouped={message.grouped}
          choices={choices}
          name={message.name}
          nameHref={message.nameHref}
          note={message.note}
          onAction={handleAction}
          presence={message.presence}
          reactions={message.menu.reactions}
          time={message.time}
        >
          {message.children}
        </MessageLayout>
      </article>
    </MessageContextMenu>
  );
}
