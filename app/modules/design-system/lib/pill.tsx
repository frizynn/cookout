import type { PillParts } from "./parts.ts";
import type { ReactNode } from "react";

const SHAPE = "min-w-5 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums";

const TONES = {
  loud: `${SHAPE} bg-unread text-white`,
  quiet: `${SHAPE} bg-muted text-muted-foreground`,
  unseen: "sr-only",
} as const;

export function Pill(parts: PillParts): ReactNode {
  return (
    <span className={TONES[parts.tone]}>
      {parts.tone !== "unseen" && <span aria-hidden="true">{String(parts.count)}</span>}{" "}
      <span className="sr-only">{parts.label}</span>
    </span>
  );
}
