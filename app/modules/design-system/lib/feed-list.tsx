import type { ListParts } from "./parts.ts";
import type { ReactNode } from "react";

export function FeedList(parts: ListParts): ReactNode {
  return <ul aria-label={parts.label}>{parts.children}</ul>;
}
