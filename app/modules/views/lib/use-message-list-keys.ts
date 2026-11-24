import type { Keymap } from "../../keymap/index.ts";
import { MESSAGE_LIST_ACTIONS } from "./message-list-keys.ts";
import { createMessageBoxKeys } from "./message-box-keys.ts";
import { messageActions } from "./message-keys.ts";
import { useEffect } from "react";

export function useMessageListKeys(keymap: Keymap): void {
  useEffect(() => {
    const box = createMessageBoxKeys();
    const { document } = globalThis;
    document.addEventListener("focusin", box.remember);
    const unbind = [
      keymap.bind({ actions: MESSAGE_LIST_ACTIONS, scope: "message list" }),
      keymap.bind({ actions: messageActions(keymap), scope: "message" }),
      keymap.bind({ actions: box.actions, scope: "text box" }),
    ];
    return (): void => {
      document.removeEventListener("focusin", box.remember);
      for (const each of unbind) {
        each();
      }
    };
  }, [keymap]);
}
