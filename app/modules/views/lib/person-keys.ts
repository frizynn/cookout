import type { Act, Keymap } from "../../keymap/index.ts";
import type { MessageShortcuts, PersonKeysSource } from "../../design-system/index.tsx";

function messagePersonOf(message: Act | null): { readonly messagePerson?: Act } {
  if (message === null) {
    return {};
  }
  return { messagePerson: message };
}

function personKeysOf(keymap: Keymap): PersonKeysSource {
  return {
    bind: ({ acts, within }) =>
      keymap.bind({
        actions: { copyName: acts.copyName, viewProfile: acts.viewProfile, ...messagePersonOf(acts.message) },
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
