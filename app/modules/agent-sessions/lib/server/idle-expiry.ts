import { Duration, String as Str } from "effect";
import { defaultIdleExpiry } from "../../index.ts";

const START = 0;
const UNIT_LENGTH = 1;

function durationIn(unit: string, count: number): Duration.Duration {
  switch (unit) {
    case "d": {
      return Duration.days(count);
    }
    case "h": {
      return Duration.hours(count);
    }
    case "m": {
      return Duration.minutes(count);
    }
    default: {
      return Duration.seconds(count);
    }
  }
}

export function idleSecondsOf(idleExpiry: string): number {
  const count = Number(Str.slice(START, -UNIT_LENGTH)(idleExpiry));
  const duration = durationIn(Str.slice(-UNIT_LENGTH)(idleExpiry), count);
  return Duration.toSeconds(duration);
}

export const defaultIdleSeconds: number = idleSecondsOf(defaultIdleExpiry);
