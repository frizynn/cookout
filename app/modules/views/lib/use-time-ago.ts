import { everySecond, timeAgo, timeOf } from "../../format/index.ts";
import type { MessageTime } from "../../format/index.ts";
import { useSyncExternalStore } from "react";

function onTick(listener: () => void): () => void {
  const stop = everySecond(listener);
  globalThis.addEventListener("visibilitychange", listener);
  return () => {
    stop();
    globalThis.removeEventListener("visibilitychange", listener);
  };
}

function useTimeAgo(at: string): string {
  return useSyncExternalStore(onTick, () => timeAgo(at));
}

function useMessageTime(at: string): MessageTime & { readonly ago: string } {
  return { ...timeOf(at), ago: useTimeAgo(at) };
}

export { useMessageTime, useTimeAgo };
