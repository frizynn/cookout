import type { Parts } from "./parts.ts";
import type { ReactNode } from "react";

export function CardBody(parts: Parts): ReactNode {
  return <div className="flex flex-col gap-3 border-b p-4 last:border-b-0">{parts.children}</div>;
}
