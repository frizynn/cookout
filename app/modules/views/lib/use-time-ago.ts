import { everySecond, timeAgo, timeOf } from "../../format/index.ts";
import type { ReceiptLineOf } from "./receipt-line.ts";
import { receiptLineOf } from "./receipt-line.ts";
import { useSyncExternalStore } from "react";

interface ShownMessageTime {
  readonly iso: string;
  readonly short: string;
  readonly full: string;
  readonly ago: string;
  readonly receipt: string | null;
}

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

function useMessageTime(of: ReceiptLineOf): ShownMessageTime {
  const ago = useTimeAgo(of.message.createdAt);
  const receipt = useSyncExternalStore(onTick, () => receiptLineOf(of));
  return { ...timeOf(of.message.createdAt), ago, receipt };
}

export { onTick, useMessageTime, useTimeAgo };
