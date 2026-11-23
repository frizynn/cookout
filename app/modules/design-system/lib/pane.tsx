import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function Pane(parts: Parts): ReactNode {
  return <section className="flex min-w-0 flex-1 flex-col">{parts.children}</section>;
}
