import type { KeyboardEvent } from "react";
import { useCallback } from "react";

type Action = "down" | "up" | "pick" | "close" | "send";

const WHILE_CHOOSING: Readonly<Partial<Record<string, Action>>> = {
  ArrowDown: "down",
  ArrowUp: "up",
  Enter: "pick",
  Escape: "close",
  Tab: "pick",
};
const WHILE_WRITING: Readonly<Partial<Record<string, Action>>> = { Enter: "send" };

interface BoxKeys {
  readonly onSend: () => void;
  readonly choosing: boolean;
  readonly onPick: () => void;
  readonly onMove: (direction: "down" | "up") => void;
  readonly onClose: () => void;
}

function actionOf(key: string, choosing: boolean): Action | null {
  if (choosing) {
    return WHILE_CHOOSING[key] ?? null;
  }
  return WHILE_WRITING[key] ?? null;
}

function useBoxKeys(keys: BoxKeys): (event: KeyboardEvent<HTMLTextAreaElement>) => void {
  const { choosing, onClose, onMove, onPick, onSend } = keys;
  return useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const action = actionOf(event.key, choosing);
      if (action === null || event.shiftKey || event.nativeEvent.isComposing) {
        return;
      }
      event.preventDefault();
      const perform: Readonly<Record<Action, () => void>> = {
        close: onClose,
        down: () => {
          onMove("down");
        },
        pick: onPick,
        send: onSend,
        up: () => {
          onMove("up");
        },
      };
      perform[action]();
    },
    [choosing, onClose, onMove, onPick, onSend],
  );
}

export { useBoxKeys };
