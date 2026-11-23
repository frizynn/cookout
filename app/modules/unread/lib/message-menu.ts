import type { MessageId } from "../../sdk/index.ts";

interface MessageMenu {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => MessageId | null;
  readonly open: (messageId: MessageId) => void;
  readonly close: () => void;
  readonly markUnread: (messageId: MessageId) => void;
}

function createMessageMenu(markUnread: (messageId: MessageId) => void): MessageMenu {
  const listeners = new Set<() => void>();
  let opened: MessageId | null = null;

  function show(next: MessageId | null): void {
    opened = next;
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    close: () => {
      show(null);
    },
    markUnread: (messageId) => {
      show(null);
      markUnread(messageId);
    },
    open: show,
    snapshot: () => opened,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type MessageMenu, createMessageMenu };
