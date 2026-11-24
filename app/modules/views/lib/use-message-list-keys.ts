import type { Keymap } from "../../keymap/index.ts";
import { MESSAGE_LIST_ACTIONS } from "./message-list-keys.ts";
import { messageActionsOf } from "./message-keys.ts";
import { useEffect } from "react";

export function useMessageListKeys(keymap: Keymap): void {
  useEffect(() => {
    const unbindList = keymap.bind({ actions: MESSAGE_LIST_ACTIONS, scope: "message list" });
    const unbindMessage = keymap.bind({ actions: messageActionsOf(keymap), scope: "message" });
    return (): void => {
      unbindList();
      unbindMessage();
    };
  }, [keymap]);
}
