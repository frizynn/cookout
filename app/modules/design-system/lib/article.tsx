import type { ListParts } from "./parts.ts";
import type { ReactNode } from "react";

export function Article(parts: ListParts): ReactNode {
  return (
    <article aria-label={parts.label} className="flex flex-col gap-1 border-b p-4 last:border-b-0">
      {parts.children}
    </article>
  );
}
