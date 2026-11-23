import type { ReactNode } from "react";

interface FeedNoteParts {
  readonly children: ReactNode;
  readonly place: "empty" | "end";
}

const PLACES = {
  empty: "px-3 py-6 text-sm text-muted-foreground",
  end: "py-4 text-center text-[11px] text-muted-foreground",
} as const;

export function FeedNote(parts: FeedNoteParts): ReactNode {
  return <p className={PLACES[parts.place]}>{parts.children}</p>;
}
