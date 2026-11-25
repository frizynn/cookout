type Subscribe = (listener: () => void) => () => void;

interface SelectedStore<State> {
  readonly subscribe: Subscribe;
  readonly snapshot: () => State;
}

function selectedStore<State>({ snapshot, subscribe }: SelectedStore<State>): SelectedStore<State> {
  return {
    snapshot,
    subscribe: (listener) => {
      let last = snapshot();
      return subscribe(() => {
        const next = snapshot();
        if (!Object.is(next, last)) {
          last = next;
          listener();
        }
      });
    },
  };
}

export { type SelectedStore, selectedStore };
