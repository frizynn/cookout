import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";

const NO_STYLE: CSSProperties = {};
const EVENTS = ["resize", "scroll"] as const;

function viewport(): VisualViewport | null {
  return globalThis.visualViewport ?? null;
}

function listen(listener: () => void): void {
  const area = viewport();
  if (area === null) {
    return;
  }
  for (const event of EVENTS) {
    area.addEventListener(event, listener);
  }
}

function unlisten(listener: () => void): void {
  const area = viewport();
  if (area === null) {
    return;
  }
  for (const event of EVENTS) {
    area.removeEventListener(event, listener);
  }
}

function subscribe(listener: () => void): () => void {
  listen(listener);
  return () => {
    unlisten(listener);
  };
}

function snapshot(): string {
  const area = viewport();
  if (area === null) {
    return "";
  }
  return `${String(area.height)} ${String(area.offsetTop)}`;
}

function styleOf(shown: string): CSSProperties {
  if (shown === "") {
    return NO_STYLE;
  }
  const [height = "", top = ""] = shown.split(" ");
  return { height: `${height}px`, transform: `translateY(${top}px)` };
}

function useVisibleArea(): CSSProperties {
  return styleOf(useSyncExternalStore(subscribe, snapshot));
}

export { useVisibleArea };
