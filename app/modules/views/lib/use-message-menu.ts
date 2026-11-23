import type { Message, MessageId } from "../../sdk/index.ts";
import type { MessageMenu } from "../../unread/index.ts";
import { useMemo } from "react";

interface MenuParts {
  readonly onMarkUnread: () => void;
}

interface MenuOf {
  readonly menu: MessageMenu;
  readonly messageId: MessageId;
}

type Reply = (name: string | null) => void;

interface ReplyOf {
  readonly reply: Reply | null;
  readonly message: Message;
  readonly me: string;
}

function useMessageMenu({ menu, messageId }: MenuOf): MenuParts {
  return useMemo(
    () => ({
      onMarkUnread: () => {
        menu.markUnread(messageId);
      },
    }),
    [menu, messageId],
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
