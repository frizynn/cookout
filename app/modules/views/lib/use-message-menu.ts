import type { Message } from "../../sdk/index.ts";
import type { MessageMenu } from "../../unread/index.ts";
import type { ReactionChoice } from "../../design-system/index.tsx";
import { useMemo } from "react";
import { useReactionChoices } from "./use-reactions.ts";

interface MenuParts {
  readonly onMarkUnread: () => void;
  readonly reactions: readonly ReactionChoice[];
}

interface MenuOf {
  readonly menu: MessageMenu;
  readonly me: string;
  readonly message: Message;
}

type Reply = (name: string | null) => void;

interface ReplyOf {
  readonly reply: Reply | null;
  readonly message: Message;
  readonly me: string;
}

function useMessageMenu({ me, menu, message }: MenuOf): MenuParts {
  const messageId = message.id;
  const reactions = useReactionChoices({ me, message });
  return useMemo(
    () => ({
      onMarkUnread: () => {
        menu.markUnread(messageId);
      },
      reactions,
    }),
    [menu, messageId, reactions],
  );
}

function mentionFor(message: Message, me: string): string | null {
  if (message.author.name === me) {
    return null;
  }
  return message.author.name;
}

function useReplyAction({ me, message, reply }: ReplyOf): (() => void) | null {
  return useMemo(() => {
    if (reply === null) {
      return null;
    }
    return () => {
      reply(mentionFor(message, me));
    };
  }, [me, message, reply]);
}

export { type Reply, useMessageMenu, useReplyAction };
