import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function Card(parts: Parts): ReactNode {
  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <section className="rounded-lg border bg-card">{parts.children}</section>
      </div>
    </div>
  );
}
