interface CalendarDay {
  readonly day: string;
  readonly number: number;
  readonly spoken: string;
  readonly inMonth: boolean;
}

interface CalendarWeek {
  readonly start: string;
  readonly days: readonly CalendarDay[];
}

interface DayShift {
  readonly day: string;
  readonly by: number;
}

interface ShownDay {
  readonly day: string;
  readonly today: string;
}

interface CalendarMonth {
  readonly month: string;
  readonly label: string;
  readonly weeks: readonly CalendarWeek[];
}

const ONE = 1;
const NONE = 0;
const WEEK_DAYS = 7;
const MONDAY_LAST = 6;
const DAY_LENGTH = 10;
const MONTH_LENGTH = 7;
const UTC = "UTC";

const spoken = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: UTC });
const named = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: UTC, year: "numeric" });
const SHORT = { day: "numeric", month: "short", timeZone: UTC, weekday: "short" } as const;
const thisYear = new Intl.DateTimeFormat("en-GB", SHORT);
const otherYear = new Intl.DateTimeFormat("en-GB", { ...SHORT, year: "numeric" });
const DAY_SHAPE = { day: "2-digit", month: "2-digit", year: "numeric" } as const;

function partsOf(text: string): readonly [number, number, number] {
  const [year = NONE, month = ONE, day = ONE] = text.split("-").map(Number);
  return [year, month, day];
}

function utcOf(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - ONE, day));
}

function dayOfUtc(at: Date): string {
  return at.toISOString().slice(NONE, DAY_LENGTH);
}

function monthOf(day: string): string {
  return day.slice(NONE, MONTH_LENGTH);
}

function dayAt(month: string, at: Date): CalendarDay {
  const day = dayOfUtc(at);
  return { day, inMonth: monthOf(day) === month, number: at.getUTCDate(), spoken: spoken.format(at) };
}

function weekFrom(month: string, start: Date): CalendarWeek {
  const days = Array.from({ length: WEEK_DAYS }, (_unused, offset) =>
    dayAt(month, utcOf(start.getUTCFullYear(), start.getUTCMonth() + ONE, start.getUTCDate() + offset)),
  );
  return { days, start: dayOfUtc(start) };
}

function calendarMonth(month: string): CalendarMonth {
  const [year, monthNumber] = partsOf(month);
  const first = utcOf(year, monthNumber, ONE);
  const length = utcOf(year, monthNumber + ONE, NONE).getUTCDate();
  const lead = (first.getUTCDay() + MONDAY_LAST) % WEEK_DAYS;
  const count = Math.ceil((lead + length) / WEEK_DAYS);
  const weeks = Array.from({ length: count }, (_unused, week) =>
    weekFrom(month, utcOf(year, monthNumber, ONE - lead + week * WEEK_DAYS)),
  );
  return { label: named.format(first), month, weeks };
}

function shiftDays(shift: DayShift): string {
  const { by } = shift;
  const [year, month, number] = partsOf(shift.day);
  return dayOfUtc(utcOf(year, month, number + by));
}

function shiftMonths(shift: DayShift): string {
  const { by } = shift;
  const [year, month, number] = partsOf(shift.day);
  const last = utcOf(year, month + by + ONE, NONE).getUTCDate();
  return dayOfUtc(utcOf(year, month + by, Math.min(number, last)));
}

function dayText(shown: ShownDay): string {
  const [year, month, number] = partsOf(shown.day);
  const at = utcOf(year, month, number);
  if (year === partsOf(shown.today)[NONE]) {
    return thisYear.format(at);
  }
  return otherYear.format(at);
}

function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { ...DAY_SHAPE, timeZone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", DAY_SHAPE).format(new Date());
  }
}

export {
  type CalendarDay,
  type CalendarMonth,
  type CalendarWeek,
  calendarMonth,
  dayText,
  monthOf,
  shiftDays,
  shiftMonths,
  todayIn,
};
