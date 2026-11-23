import type { ReactNode } from "react";

interface AccentDotParts {
  readonly place: "inline" | "message" | "grouped-message";
}

const PLACES = {
  "grouped-message": "absolute top-[9px] left-2",
  inline: "",
  message: "absolute top-[17px] left-2",
} as const;

export function AccentDot(parts: AccentDotParts): ReactNode {
  return <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full bg-mention-bar ${PLACES[parts.place]}`} />;
}
