import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function Card(parts: Parts): ReactNode {
  return <section className="rounded-lg border bg-card">{parts.children}</section>;
}
