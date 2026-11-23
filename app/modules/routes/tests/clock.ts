import { onTestFinished, vi } from "vitest";
import { openAt } from "./render.tsx";

type Opening = Parameters<typeof openAt>[number];

export function clockStopped(): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

export function clockStoppedAt(moment: string): void {
  clockStopped();
  vi.setSystemTime(moment);
}

export function openWithClockStopped(opening: Opening): () => void {
  clockStopped();
  return openAt(opening);
}
