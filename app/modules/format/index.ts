/**
 * The web UI's formats: how it writes a time for a person, in their own time
 * zone. `timeOf(iso)` is a message's short time (`2:14 PM`), its full date
 * and time for a hover, and the ISO time itself. `dayLabel(iso)` names the
 * day for a separator: `Today`, `Yesterday`, or the weekday and date
 * (`Monday, 23 November`). `dayOf(iso)` is the local day a time falls on, and
 * `millisOf(iso)` its milliseconds, to tell how far apart two times are.
 * `timeAgo(iso)` is how long ago a time was (`5m ago`), by the current time.
 * This is the web UI's one reader of `Date`.
 */
const DAY = 1;
const MINUTE = 60_000;
const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 1440;
const NONE = 0;

const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const full = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short" });
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });

const TEXT = { today: "Today", yesterday: "Yesterday" } as const;

function minuteOf(milliseconds: number): number {
  return Math.floor(milliseconds / MINUTE);
}

/** A message's time three ways: the ISO time, a short time to show, and the full date and time for a hover. */
export interface MessageTime {
  readonly iso: string;
  readonly short: string;
  readonly full: string;
}

/**
 * A time as a message shows it.
 * @param iso The ISO time.
 * @returns Its short and full forms, in the local time zone.
 */
export function timeOf(iso: string): MessageTime {
  const at = new Date(iso);
  return { full: full.format(at), iso, short: clock.format(at) };
}

/**
 * The local day a time falls on, to tell whether two times share one.
 * @param iso The ISO time.
 * @returns The day, the same string for every time on it.
 */
export function dayOf(iso: string): string {
  return new Date(iso).toDateString();
}

/**
 * A time as milliseconds since the epoch, to tell how far apart two times are.
 * @param iso The ISO time.
 * @returns Its milliseconds.
 */
export function millisOf(iso: string): number {
  return Date.parse(iso);
}

/**
 * The label of a day separator.
 * @param iso Any time on the day.
 * @returns `Today`, `Yesterday`, or the weekday and date.
 */
export function dayLabel(iso: string): string {
  const day = new Date(iso);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - DAY);
  if (day.toDateString() === new Date().toDateString()) {
    return TEXT.today;
  }
  if (day.toDateString() === yesterday.toDateString()) {
    return TEXT.yesterday;
  }
  return `${weekday.format(day)}, ${date.format(day)}`;
}

/**
 * How long ago a time was, in whole minutes, hours or days, by the current time.
 * @param iso The ISO time.
 * @returns `just now`, `5m ago`, `2h ago` or `3d ago`.
 */
export function timeAgo(iso: string): string {
  const minutes = minuteOf(Date.now()) - minuteOf(Date.parse(iso));
  if (minutes <= NONE) {
    return "just now";
  }
  if (minutes < MINUTES_IN_HOUR) {
    return `${String(minutes)}m ago`;
  }
  if (minutes < MINUTES_IN_DAY) {
    return `${String(Math.floor(minutes / MINUTES_IN_HOUR))}h ago`;
  }
  return `${String(Math.floor(minutes / MINUTES_IN_DAY))}d ago`;
}
