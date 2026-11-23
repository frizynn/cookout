import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function ItemRow(parts: Parts): ReactNode {
  return <li className="flex flex-col gap-1 px-4 py-3">{parts.children}</li>;
}
