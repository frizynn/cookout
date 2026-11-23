import { timeAgo } from "../../format/index.ts";
import { useSyncExternalStore } from "react";

function onTabShown(listener: () => void): () => void {
  globalThis.addEventListener("visibilitychange", listener);
  return () => {
    globalThis.removeEventListener("visibilitychange", listener);
  };
}

function useTimeAgo(at: string): string {
  return useSyncExternalStore(onTabShown, () => timeAgo(at));
}

export { useTimeAgo };
