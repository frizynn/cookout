import type { Clock } from "../../format/index.ts";

interface HandClock {
  readonly clock: Clock;
  readonly advance: (millis: number) => void;
}

interface Waiting {
  readonly at: number;
  readonly listener: () => void;
}

export function handClock(): HandClock {
  const waiting = new Set<Waiting>();
  let now = 0;
  return {
    advance: (millis) => {
      now += millis;
      const due = [...waiting].filter((each) => each.at <= now).toSorted((first, second) => first.at - second.at);
      for (const each of due) {
        if (waiting.delete(each)) {
          each.listener();
        }
      }
    },
    clock: {
      after: (millis, listener) => {
        const each = { at: now + millis, listener };
        waiting.add(each);
        return () => {
          waiting.delete(each);
        };
      },
    },
  };
}
