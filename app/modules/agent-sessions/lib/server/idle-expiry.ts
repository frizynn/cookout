import { Duration, Option } from "effect";
import { defaultIdleExpiry } from "../../index.ts";

const IDLE_EXPIRY = /^(?<count>[1-9]\d{0,6})(?<unit>[smhd])$/u;

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

export function idleSecondsOf(text: string): Option.Option<number> {
  const found = IDLE_EXPIRY.exec(text);
  if (found === null) {
    return Option.none();
  }
  const [, count = "", unit = ""] = found;
  const duration = durationIn(unit, Number(count));
  return Option.some(Duration.toSeconds(duration));
}

export const defaultIdleSeconds: number = Option.getOrThrow(idleSecondsOf(defaultIdleExpiry));
