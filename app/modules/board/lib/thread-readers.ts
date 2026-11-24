const NONE = 0;

interface ThreadReaders {
  readonly add: (listener: () => void, acking: boolean) => void;
  readonly remove: (listener: () => void) => void;
  readonly any: () => boolean;
  readonly acking: () => boolean;
  readonly ackingSinceAsked: () => boolean;
  readonly notify: () => void;
}

function createThreadReaders(): ThreadReaders {
  const listeners = new Set<() => void>();
  const ackers = new Set<() => void>();
  let ackerCame = false;
  return {
    acking: () => ackers.size > NONE,
    ackingSinceAsked: () => {
      const acking = ackerCame || ackers.size > NONE;
      ackerCame = false;
      return acking;
    },
    add: (listener, acking) => {
      listeners.add(listener);
      if (acking) {
        ackers.add(listener);
        ackerCame = true;
      }
    },
    any: () => listeners.size > NONE,
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    remove: (listener) => {
      listeners.delete(listener);
      ackers.delete(listener);
    },
  };
}

export { type ThreadReaders, createThreadReaders };
