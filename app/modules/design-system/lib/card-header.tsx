import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function CardHeader(parts: Parts): ReactNode {
  return <div className="flex flex-col gap-1 border-b p-4">{parts.children}</div>;
}
