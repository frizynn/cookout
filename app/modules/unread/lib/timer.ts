import type { Clock } from "../../format/index.ts";

interface Timer {
  readonly start: (millis: number, listener: () => void) => void;
  readonly cancel: () => void;
}

function createTimer(clock: Clock): Timer {
  let stop: (() => void) | null = null;
  function cancel(): void {
    if (stop !== null) {
      stop();
      stop = null;
    }
  }
  return {
    cancel,
    start: (millis, listener) => {
      cancel();
      stop = clock.after(millis, () => {
        stop = null;
        listener();
      });
    },
  };
}

export { type Timer, createTimer };
