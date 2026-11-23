import type { PresenceDotParts } from "./avatar-parts.ts";
import type { ReactNode } from "react";

const PLACES = {
  avatar: "absolute -right-0.5 -bottom-0.5 size-3 ring-2 ring-background",
  inline: "size-2 self-center",
} as const;

function lookOf(online: boolean): string {
  if (online) {
    return "fill-online";
  }
  return "fill-background stroke-muted-foreground";
}

function presenceOf(online: boolean): "online" | "offline" {
  if (online) {
    return "online";
  }
  return "offline";
}

export function PresenceDot(parts: PresenceDotParts): ReactNode {
  return (
    <span className={`flex shrink-0 rounded-full bg-background ${PLACES[parts.place ?? "avatar"]}`} title={parts.label}>
      <svg
        aria-label={parts.label}
        className={`size-full ${lookOf(parts.online)}`}
        data-presence={presenceOf(parts.online)}
        role="img"
        viewBox="0 0 12 12"
      >
        <circle cx="6" cy="6" r="4.5" strokeWidth="2.5" />
      </svg>
    </span>
  );
}
