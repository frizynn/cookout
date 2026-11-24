import type { Act, Action, Keymap } from "../../keymap/index.ts";

const MESSAGE = "article";

function press(keymap: Keymap, action: Action): Act {
  return ({ target }) => {
    if (!(target instanceof HTMLElement) || !target.matches(MESSAGE)) {
      return false;
    }
    const button = target.querySelector<HTMLElement>(`[aria-keyshortcuts="${keymap.shortcutOf(action).keys}"]`);
    if (button === null) {
      return false;
    }
    button.click();
    return true;
  };
}

function messageActions(keymap: Keymap): Readonly<Record<"toggleThumbsDown" | "toggleThumbsUp", Act>> {
  return { toggleThumbsDown: press(keymap, "toggleThumbsDown"), toggleThumbsUp: press(keymap, "toggleThumbsUp") };
}

export { messageActions };
