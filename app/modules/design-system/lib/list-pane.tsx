import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

interface ListPaneParts extends Parts {
  readonly hiddenWhenNarrow: boolean;
}

function lookOf(hiddenWhenNarrow: boolean): string {
  if (hiddenWhenNarrow) {
    return "hidden md:flex";
  }
  return "flex";
}

export function ListPane(parts: ListPaneParts): ReactNode {
  return <section className={`min-w-0 flex-1 flex-col ${lookOf(parts.hiddenWhenNarrow)}`}>{parts.children}</section>;
}
