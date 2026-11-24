import type { Act } from "../../keymap/index.ts";

const BOX = 'textarea[name="text"]';
const MESSAGE = "article";
const LAST = -1;
const EMPTY = "";

interface MessageBoxKeys {
  readonly remember: (event: unknown) => void;
  readonly actions: Readonly<Record<"leaveTextBox" | "newestMessage", Act>>;
}

function boxOf(target: unknown): HTMLTextAreaElement | null {
  if (target instanceof HTMLTextAreaElement && target.matches(BOX)) {
    return target;
  }
  return null;
}

function emptyBoxOf(target: unknown): HTMLTextAreaElement | null {
  const box = boxOf(target);
  if (box === null || box.value !== EMPTY) {
    return null;
  }
  return box;
}

function newestNear(box: unknown): unknown {
  if (!(box instanceof HTMLElement)) {
    return null;
  }
  for (let around = box.parentElement; around !== null; around = around.parentElement) {
    const newest = [...around.querySelectorAll<HTMLElement>(MESSAGE)].at(LAST) ?? null;
    if (newest !== null) {
      return newest;
    }
  }
  return null;
}

function focusedOn(element: unknown): boolean {
  if (!(element instanceof HTMLElement) || !element.isConnected) {
    return false;
  }
  element.focus();
  return globalThis.document.activeElement === element;
}

function messageOf(element: unknown): unknown {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  return element.closest(MESSAGE);
}

function createMessageBoxKeys(): MessageBoxKeys {
  const before = new WeakMap<HTMLElement, HTMLElement>();
  return {
    actions: {
      leaveTextBox: ({ target }) => {
        const box = boxOf(target);
        if (box === null) {
          return false;
        }
        const previous = before.get(box);
        box.blur();
        if (!focusedOn(previous) && !focusedOn(messageOf(previous))) {
          focusedOn(newestNear(box));
        }
        return true;
      },
      newestMessage: ({ target }) => focusedOn(newestNear(emptyBoxOf(target))),
    },
    remember: (event) => {
      if (!(event instanceof FocusEvent)) {
        return;
      }
      const box = boxOf(event.target);
      if (box === null) {
        return;
      }
      if (event.relatedTarget instanceof HTMLElement) {
        before.set(box, event.relatedTarget);
      } else {
        before.delete(box);
      }
    },
  };
}

export { createMessageBoxKeys };
