import type { MessageId, Refusal } from "../../sdk/index.ts";

type MarkUnread = (messageId: MessageId, onRefused: (refusal: Refusal) => void) => void;

interface MessageMenu {
  readonly subscribe: (listener: () => void) => () => void;
  readonly refusal: () => Refusal | null;
  readonly markUnread: (messageId: MessageId) => void;
}

function createMessageMenu(markUnread: MarkUnread): MessageMenu {
  const listeners = new Set<() => void>();
  let refused: Refusal | null = null;

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    markUnread: (messageId) => {
      refused = null;
      notify();
      markUnread(messageId, (refusal) => {
        refused = refusal;
        notify();
      });
    },
    refusal: () => refused,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type MessageMenu, createMessageMenu };
