import type { ListParts } from "./parts.ts";
import type { ReactNode } from "react";

export function Panel(parts: ListParts): ReactNode {
  return (
    <section
      aria-label={parts.label}
      className="absolute right-2 bottom-full left-2 mb-2 flex flex-col gap-3 rounded-lg border bg-background p-3 shadow-lg"
    >
      <h2 className="text-sm font-semibold">{parts.label}</h2>
      {parts.children}
    </section>
  );
}
