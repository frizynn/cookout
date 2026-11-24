interface PageFocusAdapter {
  readonly focused: () => boolean;
  readonly listen: (onChange: () => void) => () => void;
}
interface PageFocus {
  readonly subscribe: (listener: () => void) => () => void;
  readonly focused: () => boolean;
}

const NONE = 0;
function createPageFocus(adapter: PageFocusAdapter): PageFocus {
  const listeners = new Set<() => void>();
  let last = adapter.focused();
  let stop: (() => void) | null = null;

  function changed(): void {
    const now = adapter.focused();
    if (now === last) {
      return;
    }
    last = now;
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    focused: () => {
      if (stop === null) {
        last = adapter.focused();
      }
      return last;
    },
    subscribe: (listener) => {
      if (stop === null) {
        last = adapter.focused();
        stop = adapter.listen(changed);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === NONE && stop !== null) {
          stop();
          stop = null;
        }
      };
    },
  };
}

export { type PageFocus, type PageFocusAdapter, createPageFocus };
