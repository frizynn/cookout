import { useSyncExternalStore } from "react";

const MINUTE = 60_000;
const HOUR = 60;
const DAY = 1440;
const NONE = 0;

function onTabShown(listener: () => void): () => void {
  globalThis.addEventListener("visibilitychange", listener);
  return () => {
    globalThis.removeEventListener("visibilitychange", listener);
  };
}

function minuteOf(milliseconds: number): number {
  return Math.floor(milliseconds / MINUTE);
}

function thisMinute(): number {
  return minuteOf(Date.now());
}

function shortTime(minutes: number): string {
  if (minutes <= NONE) {
    return "just now";
  }
  if (minutes < HOUR) {
    return `${String(minutes)}m ago`;
  }
  if (minutes < DAY) {
    return `${String(Math.floor(minutes / HOUR))}h ago`;
  }
  return `${String(Math.floor(minutes / DAY))}d ago`;
}

function useTimeAgo(at: string): string {
  const minute = useSyncExternalStore(onTabShown, thisMinute);
  return shortTime(minute - minuteOf(Date.parse(at)));
}

export { useTimeAgo };
