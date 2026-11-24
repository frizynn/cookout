interface Clock {
  readonly after: (millis: number, listener: () => void) => () => void;
}

const browserClock: Clock = {
  after: (millis, listener) => {
    const waiting = globalThis.setTimeout(listener, millis);
    return () => {
      globalThis.clearTimeout(waiting);
    };
  },
};

export { type Clock, browserClock };
