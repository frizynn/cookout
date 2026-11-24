import type { MessageShortcuts, PersonKeysSource } from "../../design-system/messages.tsx";
import type { Keymap } from "../../keymap/index.ts";

function personKeysOf(keymap: Keymap): PersonKeysSource {
  return {
    bind: ({ acts, within }) =>
      keymap.bind({
        actions: { copyName: acts.copyName, messagePerson: acts.message, viewProfile: acts.viewProfile },
        scope: "person",
        within,
      }),
    shortcuts: {
      copyName: keymap.shortcutOf("copyName"),
      message: keymap.shortcutOf("messagePerson"),
      viewProfile: keymap.shortcutOf("viewProfile"),
    },
  };
}

function messageShortcutsOf(keymap: Keymap): MessageShortcuts {
  return { openThread: keymap.shortcutOf("openThread"), reply: keymap.shortcutOf("replyToMessage") };
}

export { messageShortcutsOf, personKeysOf };
