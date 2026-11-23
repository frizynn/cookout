interface Notifier<State> {
  readonly current: () => State;
  readonly publish: (state: State) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

function createNotifier<State>(initial: State): Notifier<State> {
  const listeners = new Set<() => void>();
  let current = initial;
  return {
    current: () => current,
    publish: (state) => {
      current = state;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type Notifier, createNotifier };
