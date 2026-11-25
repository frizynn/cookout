interface Listeners {
  readonly add: (listener: () => void) => () => void;
  readonly notify: () => void;
}

function listenersOf(show: () => () => void): Listeners {
  const listeners = new Set<() => void>();
  return {
    add: (listener) => {
      listeners.add(listener);
      const hide = show();
      return () => {
        listeners.delete(listener);
        hide();
      };
    },
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function sameField(before: unknown, after: unknown): boolean {
  if (Array.isArray(before) && Array.isArray(after)) {
    return before.length === after.length && before.every((each, index) => Object.is(each, after[index]));
  }
  return Object.is(before, after);
}

interface Snapshots {
  readonly before: object;
  readonly after: object;
}

function sameSnapshot({ after, before }: Snapshots): boolean {
  const keys = Object.keys(after);
  return (
    keys.length === Object.keys(before).length &&
    keys.every((key) => sameField(Reflect.get(before, key), Reflect.get(after, key)))
  );
}

export { listenersOf, sameSnapshot };
