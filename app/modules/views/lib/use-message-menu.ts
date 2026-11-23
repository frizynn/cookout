import type { Message, MessageId } from "../../sdk/index.ts";
import { useMemo, useSyncExternalStore } from "react";
import type { MessageMenu } from "../../unread/index.ts";

interface MenuParts {
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onMarkUnread: () => void;
}

interface MenuOf {
  readonly menu: MessageMenu;
  readonly messageId: MessageId;
  readonly place: "parent" | "stream";
}

type Reply = (name: string | null) => void;

interface ReplyOf {
  readonly reply: Reply | null;
  readonly message: Message;
  readonly me: string;
}

function useMessageMenu({ menu, messageId, place }: MenuOf): MenuParts {
  const opened = useSyncExternalStore(menu.subscribe, menu.snapshot);
  const key = `${place}/${String(messageId)}`;
  const open = opened === key;
  return useMemo(
    () => ({
      onClose: menu.close,
      onMarkUnread: () => {
        menu.markUnread(messageId);
      },
      onOpen: () => {
        menu.open(key);
      },
      open,
    }),
    [key, menu, messageId, open],
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
