import type { Clock } from "../src/index.ts";

export type FakeClock = Clock & {
  /** Moves time forward by `milliseconds`. */
  advance(milliseconds: number): void;
  /** Jumps to `time`. */
  set(time: Date): void;
};

/** A clock that only moves when the test moves it. */
export function createFakeClock(start: Date): FakeClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(milliseconds) {
      current += milliseconds;
    },
    set(time) {
      current = time.getTime();
    },
  };
}
