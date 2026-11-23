import type { CountParts } from "./parts.ts";
import type { ReactNode } from "react";

const TONES = {
  mention: { prefix: "@", style: "bg-foreground text-background" },
  plain: { prefix: "", style: "bg-muted text-muted-foreground" },
} as const;

export function Count(parts: CountParts): ReactNode {
  const tone = TONES[parts.tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone.style}`}>
      <span aria-hidden="true">{`${tone.prefix}${String(parts.count)}`}</span>
      <span className="sr-only">{parts.label}</span>
    </span>
  );
}
