import type { MessageId, Refusal } from "../../sdk/index.ts";

type MarkUnread = (messageId: MessageId, onRefused: (refusal: Refusal) => void) => void;

interface MessageMenu {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => string | null;
  readonly refusal: () => Refusal | null;
  readonly open: (key: string) => void;
  readonly close: () => void;
  readonly markUnread: (messageId: MessageId) => void;
}

function createMessageMenu(markUnread: MarkUnread): MessageMenu {
  const listeners = new Set<() => void>();
  let opened: string | null = null;
  let refused: Refusal | null = null;

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function show(next: string | null): void {
    opened = next;
    notify();
  }

  return {
    close: () => {
      show(null);
    },
    markUnread: (messageId) => {
      refused = null;
      show(null);
      markUnread(messageId, (refusal) => {
        refused = refusal;
        notify();
      });
    },
    open: show,
    refusal: () => refused,
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
