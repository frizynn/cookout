import type { createPageFocus } from "../../page-focus/index.ts";

type PageFocusAdapter = Parameters<typeof createPageFocus>[number];

interface HandFocus {
  readonly adapter: PageFocusAdapter;
  readonly blur: () => void;
  readonly focus: () => void;
  readonly hide: () => void;
  readonly show: () => void;
}

function handFocus(): HandFocus {
  const listeners = new Set<() => void>();
  let focused = true;
  let visible = true;

  function set(change: () => void): void {
    change();
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    adapter: {
      focused: () => focused && visible,
      listen: (onChange) => {
        listeners.add(onChange);
        return () => {
          listeners.delete(onChange);
        };
      },
    },
    blur: () => {
      set(() => {
        focused = false;
      });
    },
    focus: () => {
      set(() => {
        focused = true;
      });
    },
    hide: () => {
      set(() => {
        visible = false;
      });
    },
    show: () => {
      set(() => {
        visible = true;
      });
    },
  };
}

export { type HandFocus, handFocus };
