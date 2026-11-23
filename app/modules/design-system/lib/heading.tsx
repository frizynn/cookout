import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function Heading(parts: Parts): ReactNode {
  return <h1 className="text-sm font-semibold tracking-tight">{parts.children}</h1>;
}
